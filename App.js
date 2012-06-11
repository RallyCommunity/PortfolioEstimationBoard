
Ext.define('PortfolioEstimationBoard', {
    extend:'Rally.app.App',
    layout:'auto',
    appName:'Portfolio Estimation Board',


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
        this.typeCombo = Ext.widget('rallycombobox', {
            fieldLabel:'Type',
            labelWidth:30,
            labelClsExtra:'rui-label',
            stateful:false,
            storeConfig:{
                autoLoad:true,
                remoteFilter:false,
                model:'Type',
                sorters:{
                    property:'ordinalValue',
                    direction:'Desc'
                },
                cls:'typeCombo',
                defaultSelectionToFirst:false,
                context:this.getContext().getDataContext()
            }
        });

        this.typeCombo.on('select', this._loadCardboard, this);
        this.typeCombo.store.on('load', this._loadCardboard, this);
        this.down('#header').add(this.typeCombo);
    },

    _loadCardboard:function () {
        this._loadStates({
            success:function (states) {
                var columns = this._createColumns(states);
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
        this.currentType = this.typeCombo.getValue();

        Ext.create('Rally.data.WsapiDataStore', {
            model:'PreliminaryEstimate',
            context:this.getContext().getDataContext(),
            autoLoad:true,
            fetch : true,
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

            cardboard = Ext.widget('rallycardboard', {
                types:['PortfolioItem'],
                itemId:'cardboard',
                attribute:'PreliminaryEstimate',
                columns:columns,
                maxColumnsPerBoard:columns.length,
                ddGroup:this.typeCombo.getValue(),
                enableRanking:this.getContext().get('workspace').WorkspaceConfiguration.DragDropRankingEnabled,
                columnConfig:{
                    xtype:'rallykanbancolumn'
                },
                cardConfig:{
                    xtype:'rallyportfoliokanbancard'
                },
                storeConfig:{
                    filters:[
                        {
                            property:'PortfolioItemType',
                            value:this.currentType
                        }
                    ]
                },

                loadDescription:'Portfolio Estimation Board'
            });

            this.down('#bodyContainer').add(cardboard);

            this._attachPercentDoneToolTip(cardboard);

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

            columns = [
                {
                    displayValue:'No Entry',
                    value:null,
                    cardLimit:50
                }
            ];

            Ext.Array.each(states, function (state) {
                columns.push({
                    value:state.get('_ref'),
                    displayValue:state.get('Name'),
                    wipLimit:state.get('WIPLimit'),
                    policies:state.get('Description')
                });
            });
        }

        return columns;
    },

    _attachPercentDoneToolTip:function (cardboard) {
        Ext.create('Rally.ui.tooltip.PercentDoneToolTip', {
            target:cardboard.getEl(),
            delegate:'.percentDoneContainer',
            listeners:{
                beforeshow:function (tip) {

                    var cardElement = Ext.get(tip.triggerElement).up('.cardContainer');
                    var card = Ext.getCmp(cardElement.id);

                    tip.updateContent(card.getRecord().data);
                },
                scope:this
            }
        });
    }



});

