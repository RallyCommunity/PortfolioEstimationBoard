Ext.define('PortfolioEstimationBoard', {
    extend:'Rally.app.App',
    layout:'auto',
    appName:'Portfolio Estimation Board',

    hidden:true,

    /**
     * The currently selected type
     */
    currentType:undefined,

    /**
     * An object that contains the parents for each type with the types key being the ref
     */
    typeParents:undefined,

    /**
     * The record that is the current parent, the cardboard will be filtered by it
     */
    currentParent:undefined,

    /**
     * @override
     */
    getSettingsFields:function () {
        return [
            {
                name:'type',
                xtype:'rallycombobox',
                storeConfig:{
                    model:'TypeDefinition',
                    filters:[
                        Ext.create('Rally.data.QueryFilter', {
                            property:'TypePath',
                            operator:'Contains',
                            value:'PortfolioItem/'
                        })
                    ],
                    sorters:{
                        property:'ordinalValue',
                        direction:'Asc'
                    },
                    autoLoad:false
                },
                readyEvent:'ready'
            }
        ];
    },


    /**
     * @override
     */
    items:[
        {
            xtype:'container',
            itemId:'header',
            cls:'header'
        },
        {
            xtype:'container',
            itemId:'bodyContainer',
            width:'100%'
        }
    ],

    /**
     * @override
     */
    launch:function () {
        var store = Ext.create('Rally.data.WsapiDataStore', {
            autoLoad:true,
            remoteFilter:false,
            filters:[
                Ext.create('Rally.data.QueryFilter', {
                    property:'TypePath',
                    operator:'Contains',
                    value:'PortfolioItem/'
                })
            ],
            model:'TypeDefinition',
            sorters:{
                property:'ordinalValue',
                direction:'Asc'
            },
            context:this.getContext().getDataContext()
        });

        store.on('load', this._loadTypes, this);

        this.down('#header').add(
            [
                this.typeCombo,
                {
                    xtype:'rallybutton',
                    itemId:'parentButton',
                    cls:'button',
                    text:'Parent Filter Disabled',
                    handler:this._openChooserForFilter,
                    disabled:true,
                    scope:this
                },

                {
                    itemId:'clearButton',
                    xtype:'rallybutton',
                    cls:'button',
                    hidden:true,
                    text:'Remove Filter',
                    handler:this._clearFilter,
                    scope:this
                }
            ]);
    },


    /**
     * @private
     */
    _showClearButton:function (currentParent) {
        this.currentParent = currentParent;
        var button = this.down('#clearButton');
        button.setVisible(true);

    },

    /**
     * @private
     */
    _clearFilter:function (button) {
        button.setVisible(false);
        this.currentParent = null;
        this._loadCardboard();
    },

    /**
     * @private
     */
    _manageParentChooserButton:function () {
        var button = this.down(".rallybutton");
        if (this.typeParents[this.currentType]) {
            button.setText('Filter By ' + this.typeParents[this.currentType].get('_refObjectName'));
            button.setDisabled(false);
        }
        else {
            button.setText('Parent Filter Disabled');
            button.setDisabled(true);
        }

    },

    /**
     * @private
     */
    _openChooserForFilter:function () {
        var filters = [];
        var parent = this.typeParents[this.currentType];
        if (parent) {
            filters.push({
                property:'PortfolioItemType',
                value:parent.get('_ref')
            });
        }

        Ext.create('Rally.ui.dialog.ChooserDialog', {
            artifactTypes:['portfolioitem'],
            autoShow:true,
            title:'Choose ' + parent.get('_refObjectName'),
            storeConfig:{
                filters:filters
            },
            listeners:{
                artifactChosen:function (selectedRecord) {
                    this._showClearButton(selectedRecord);
                    this._loadCardboard();
                },
                scope:this
            }
        });
    },

    /**
     * @private
     */
    _loadTypes:function (store, records) {
        this.typeParents = {};
        var ascRecords = records.concat().reverse();
        this.currentType = this.getSetting("type")||records[0].get('_ref');
        var previousType;
        Ext.each(ascRecords, function (type) {
            var ref = type.get('_ref');
            this.typeParents[ref] = previousType;
            previousType = type;
        }, this);

        this.types = records;
        this._loadCardboard();
    },


    /**
     * @private
     */
    _loadCardboard:function () {
        this._manageParentChooserButton();
        this._loadStates({
            success:function (states) {
                var columns = this._createColumns(states);
                this.setVisible(true);
                this._drawCardboard(columns);
            },
            scope:this
        });
    },

    /**
     * @private
     * We need the States of the selected Portfolio Item Type to know what columns to show.
     * Whenever the type changes, reload the states to redraw the cardboard.
     * @param options
     * @param options.success called when states are loaded
     * @param options.scope the scope to call success with
     */
    _loadStates:function (options) {
        Ext.create('Rally.data.WsapiDataStore', {
            model:'PreliminaryEstimate',
            context:this.getContext().getDataContext(),
            autoLoad:true,
            fetch:true,
            sorters:[
                {
                    property:'Value',
                    direction:'ASC'
                }
            ],
            listeners:{
                load:function (store, records) {
                    if (options.success) {
                        options.success.call(options.scope || this, records);
                    }
                }
            }
        });

    },

    /**
     * Given a set of columns, build a cardboard component. Otherwise show an empty message.
     * @param columns
     */
    _drawCardboard:function (columns) {
        if (columns) {
            var cardboard = this.down('#cardboard');
            if (cardboard) {
                cardboard.destroy();
            }
            var filters = [
                {
                    property:'PortfolioItemType',
                    value:this.currentType
                }
            ];
            if (this.currentParent) {
                filters.push({
                    property:'Parent',
                    value:this.currentParent.get('_ref')
                });
            }
            cardboard = Ext.widget('rallycardboard', {
                types:['PortfolioItem'],
                itemId:'cardboard',
                attribute:'PreliminaryEstimate',
                columns:columns,
                maxColumnsPerBoard:columns.length,
                ddGroup:this.currentType,
                enableRanking:this.getContext().get('workspace').WorkspaceConfiguration.DragDropRankingEnabled,
                cardConfig:{
                    xtype:"rallyportfolioestimationcard",
                    showIconMenus:true
                },
                storeConfig:{
                    filters:filters
                },
                loadDescription:'Portfolio Estimation Board'
            });

            this.down('#bodyContainer').add(cardboard);

            Ext.EventManager.onWindowResize(cardboard.resizeAllColumns, cardboard);
        } else {
            this._showNoColumns();
        }

    },

    _showNoColumns:function () {
        this.add({
            xtype:'container',
            cls:'no-type-text',
            html:'<p>This Type has no states defined.</p>'
        });
    },

    /**
     * @private
     * @return columns for the cardboard, as a map with keys being the column name.
     */
    _createColumns:function (states) {
        var columns;

        if (states.length) {
            var fakeState = states[0].copy();
            fakeState.set("Name", "No Entry");
            columns = [
                {
                    value:null,
                    record:fakeState,
                    displayField:'Name',
                    cardLimit:50,
                    columnHeaderConfig:{
                        fieldToDisplay:"Name",
                        record:fakeState,
                        editable:false
                    }
                }
            ];
            Ext.Array.each(states, function (state) {
                columns.push({
                    xtype:"rallycardboardcolumn",
                    displayField:'Name',
                    value:state.get('_ref'),
                    record:state,
                    columnHeaderConfig:{
                        fieldToDisplay:"Name",
                        record:state,
                        editable:true
                    }
                });
            });
        }

        return columns;
    }


})
;

