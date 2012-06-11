Ext.define('Rally.app.AddNew', {
    extend:'Rally.ui.AddNew',
    alias:'widget.addnew',
    updateButtonText:function(text){
        var newContainer = this.down('#new');
        this.newButtonText = text;
        newContainer.setText(text);
    }
});