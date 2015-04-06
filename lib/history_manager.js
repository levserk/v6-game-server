var util = require('util');
var math = require('math');
module.exports = HistoryManager;

function HistoryManager(server){

    var self = this;
    this.server = server;

}


HistoryManager.prototype.onMessage = function(message, type){
    var data = message.data;
    switch (type) {//TODO: check mode isn't wrong, userId
        case 'history': // load history
            this.loadHistory(message.sender, data.userId||message.sender.userId, data.mode, data.count, data.offset);
            break;
        case 'game': // load game history and params
            this.loadGame(message.sender, data.userId||message.sender.userId,  data.id, data.mode);
            break;
    }
};


HistoryManager.prototype.loadHistory = function(sender, userId, mode, count, offset){
    if (!userId || !mode){
        util.log('err;', 'HistoryManager.loadHistory ', 'wrong arguments', userId, mode);
        return;
    }
    count = count || 10;
    offset = offset || 0;
    var self = this;
    this.server.storage.getHistory(userId, mode, count, offset)
        .then(function(history){
            self.server.router.send({
                    module: 'history_manager',
                    type: 'history',
                    target: sender,
                    data: {
                        mode:mode,
                        history:history,
                        userId:userId
                    }
                }
            );
        })
        .catch(function(err){
            util.log('err;', 'HistoryManager.loadHistory error', err);
            self.server.router.send({
                    module: 'history_manager',
                    type: 'history',
                    target: sender,
                    data: {
                        mode:mode,
                        history:[],
                        userId:userId
                    }
                }
            );
        });
};


HistoryManager.prototype.loadGame = function(sender, userId, id, mode){
    if (!userId || !id){
        util.log('err;', 'HistoryManager.loadGame ', 'wrong arguments', userId, id);
        return;
    }
    var self = this;
    this.server.storage.getGame(userId, id, mode)
        .then(function(game){
            self.server.router.send({
                    module: 'history_manager',
                    type: 'game',
                    target: sender,
                    data: {
                        mode: mode,
                        game: game
                    }
                }
            );
        })
        .catch(function(err){
            util.log('err;', 'HistoryManager.loadGame error', err);
            self.server.router.send({
                    module: 'history_manager',
                    type: 'game',
                    target: sender,
                    data: {
                        mode: mode,
                        game: {}
                    }
                }
            );
        });
};