var util = require('util');
var math = require('math');
module.exports = HistoryManager;

function HistoryManager(server){

    var self = this;
    this.server = server;

}


HistoryManager.prototype.onMessage = function(message, type){
    switch (type) {//TODO: check mode isn't wrong, userId
        case 'history': // load history
            var userId = message.data.userId||message.sender.userId;
            var history = this.server.storage.getHistory(userId, message.data.mode);
            this.server.router.send({
                    module: 'history_manager',
                    type: 'history',
                    target: message.sender,
                    data: {
                        mode:message.data.mode,
                        history:history,
                        userId:userId
                    }
                }
            );
            break;
        case 'game': // load game history and params
            var game = this.server.storage.getGame(message.data.userId||message.sender.userId, message.data.id, message.data.mode);
            this.server.router.send({
                    module: 'history_manager',
                    type: 'game',
                    target: message.sender,
                    data: {
                        mode: message.data.mode,
                        game: game
                    }
                }
            );
            break;
    }
};