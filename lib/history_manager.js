var util = require('util');
var logger = require('./logger.js');

module.exports = HistoryManager;

function HistoryManager(server){

    var self = this;
    this.server = server;

}


HistoryManager.prototype.onMessage = function(message, type){
    var data = message.data;
    switch (type) {//TODO: check mode isn't wrong, userId
        case 'history': // load history
            this.loadHistory(message.sender, data.userId||message.sender.userId, data.mode, data.count, data.offset, data.filter);
            break;
        case 'game': // load game history and params
            this.loadGame(message.sender, data.userId||message.sender.userId,  data.id, data.mode);
            break;
    }
};


HistoryManager.prototype.loadHistory = function(sender, userId, mode, count, offset, filter){
    if (!userId || !mode){
        logger.err('HistoryManager.loadHistory ', 'wrong arguments', userId, mode, 1);
        return;
    }
    var self = this;
    this.server.storage.getHistory(userId, mode, count, offset, filter)
        .then(function(results){
            try {
                self.server.router.send({
                        module: 'history_manager',
                        type: 'history',
                        target: sender,
                        data: {
                            mode: mode,
                            history: results[0],
                            penalties: results[1],
                            userId: userId
                        }
                    }
                );
            } catch (err) {
                logger.err('HistoryManager.loadHistory error', err, 1);
                self.sendEmptyHistory(sender, mode, userId);
            }
        })
        .catch(function(err){
            logger.err('HistoryManager.loadHistory error', err, 1);
            self.sendEmptyHistory(sender, mode, userId)
        });
};

HistoryManager.prototype.sendEmptyHistory = function(sender, mode, userId) {
    this.server.router.send({
            module: 'history_manager',
            type: 'history',
            target: sender,
            data: {
                mode: mode,
                history:[],
                penalties:null,
                userId:userId
            }
        }
    );
};



HistoryManager.prototype.loadGame = function(sender, userId, id, mode){
    if (!userId || !id){
        logger.err('HistoryManager.loadGame ', 'wrong arguments', userId, id, 1);
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
            logger.err('HistoryManager.loadGame error', err, 1);
            self.server.router.send({
                    module: 'history_manager',
                    type: 'game',
                    target: sender,
                    data: {
                        mode: mode,
                        game: null
                    }
                }
            );
        });
};