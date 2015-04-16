var EventEmitter = require('events').EventEmitter;
var util = require('util');
var logger = require('./logger.js');

module.exports = Router;

function Router(server){
    EventEmitter.call(this);

    var self = this;
    this.server = server;
    this.wss = server.wss;

    // bind events
    this.wss.on('connection', function(socket){
        logger.log('Router', "new socket_connection", socket.id, socket.cookie._userId, 3);

        socket.on('disconnect', function(reason){
            if (reason == 'timeout') {
                self.emit('socket_timeout', socket);
            } else {
                self.emit('socket_disconnected', socket);
            }
        });
        socket.on('message', function(message){
            self.onSocketMessage(this, message);
        });
        self.emit('socket_connection', socket);
    });

    this.server.on('user_login', function(user){
        self.send({
           module:"server", type: "user_login", sender:user, target:self.server.game, data:user.getInfo()
        });
    });
    this.server.on('user_relogin', function(user){
        self.send({
            module:"server", type: "user_relogin", sender:user, target:self.server.game, data:user.getInfo()
        });
    });
    this.server.on('user_leave', function(user){
        var userRoom = self.server.gameManager.getUserRoom(user, true);
        if (self.wss.rooms[self.server.game] && (!userRoom || !userRoom.isPlaying()))
            self.send({
                module:"server", type: "user_leave", target:self.server.game, data:user.userId
            });
    });
}

util.inherits(Router, EventEmitter);


Router.prototype.onSocketMessage = function(socket, message){
    if (typeof message.type != "string" || typeof message.module != "string" || !message.data || !message.target) {
        logger.warn('wrong income message', message, 1);
        return;
    }
    message.sender = message.type == 'login' ? socket : this.server.getUserById(socket.id);
    switch (message.module) {
        case 'invite_manager': this.server.inviteManager.onMessage(message, message.type); break;
        case 'game_manager': this.server.gameManager.onMessage(message, message.type); break;
        case 'chat_manager': this.server.chatManager.onMessage(message, message.type); break;
        case 'history_manager': this.server.historyManager.onMessage(message, message.type); break;
        case 'rating_manager': this.server.ratingManager.onMessage(message, message.type); break;
        case 'server': this.server.onMessage(message, message.type); break;
        case 'admin': this.server.adminManager.onMessage(message, message.type); break;
    }
};


Router.prototype.send = function(message){
    if (!message.type || !message.module || !message.data || !message.target) {
        logger.err('wrong sent message', message, 1);
        return;
    }

    logger.log("Router.send", message.module, message.type, 3);

    var target = message.target,
        sender = message.sender;
    delete message.sender;
    delete message.target;
    switch (target.name){
        case '__Socket__':
            target.send(message);
            break;
        case '__User__':
            target.socket.send(message);
            break;
        case '__Room__':
            if (sender && sender.socket) sender.socket.in(target.id).send(message);
            else this.wss.in(target.id).broadcast(message);
            break;
        default:
            if (typeof target == "string") {
                if (sender && sender.socket) sender.socket.in(target).send(message);
                else this.wss.in(target).broadcast(message);
            } else throw new Error('wrong target! ' + target);
    }
};