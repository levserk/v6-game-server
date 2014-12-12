var EventEmitter = require('events').EventEmitter;
var util = require('util');

module.exports = Router;

function Router(server){
    EventEmitter.call(this);

    var self = this;
    this.server = server;
    this.wss = server.wss;

    // bind events
    this.wss.on('connection', function(socket){
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
           module:"server", type: "user_login", sender:user, target:{room:self.server.game}, data:user.getInfo()
        });
    });
    this.server.on('user_leave', function(user){
        if (self.server.storage.users.length>0) // TODO: HACK! CHECK, when last user leave, main room will be closed, nobody to send
            self.send({
                module:"server", type: "user_leave", target:{room:self.server.game}, data:user.userId
            });
    });
}

util.inherits(Router, EventEmitter);


Router.prototype.onSocketMessage = function(socket, message){
    if (typeof message.type != "string" || typeof message.module != "string" || !message.data || !message.target) {
        util.log('warn;', 'wrong income message', message);
        return;
    }
    message.sender = this.server.getUserById(socket.id);
    switch (message.module) {
        case 'invite_manager': this.server.inviteManager.onMessage(message, message.type); break;
        case 'game_manager': this.server.gameManager.onMessage(message, message.type); break;
    }
};


Router.prototype.send = function(message){
    if (typeof message.type != "string" || typeof message.module != "string" || !message.data || !message.target) {
        util.log('warn;', 'wrong sent message', message);
        return;
    }

    util.log("log;", "Router.send", message.module, message.type);

    var target = message.target,
        sender = message.sender;
    delete message.sender;
    delete message.target;
    if (target.socket){
        target.socket.send(message);
        return;
    }
    if (target.user){
        if (typeof target.user != "object") target.user = this.server.getUserById(target.user);
        target.user.socket.send(message);
        return;
    }
    if (target.room){
        if (sender && sender.socket) sender.socket.in(target.room).send(message);
        else this.wss.in(target.room).broadcast(message);
    }
};