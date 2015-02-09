var util = require('util');
var math = require('math');
module.exports = HistoryManager;

function HistoryManager(server){

    var self = this;
    this.server = server;

}


HistoryManager.prototype.onMessage = function(message, type){
    switch (type) {
        case 'history': // load history
                        //TODO: check mode isn't wrong
            var history = this.server.storage.getHistory(message.sender, message.data.mode);
            this.server.router.send({
                    module: 'history_manager',
                    type: 'history',
                    target: message.sender,
                    data: {
                        mode:message.data.mode,
                        history:history
                    }
                }
            );
            break;
    }
};