//var EventEmitter = require('events').EventEmitter;
var util = require('util');

module.exports = ChatManager;

function ChatManager(server){
    this.server = server;
    this.default = server.game;
}


ChatManager.prototype.onMessage = function(message, type){
    var data = message.data;
    switch (type){
        case 'message':
            this.sendMessage(message.sender, data.text, data.target, data.admin);
            break;
        case 'load':
            this.loadMessages(message.sender, 5, data.time, data.target || this.default);
            break;
        case 'ban':
            if (message.sender.isAdmin || this.server.conf.mode == 'debug' || this.server.conf.mode == 'develop')
                this.banUser(data.userId, data.days, data.reason);
            break;
    }
};


ChatManager.prototype.sendMessage = function(user, text, target, isAdmin){
    // TODO: check ban user, text length
    if (user.isBanned){
        util.log('warn', 'ChatManager.sendMessage', 'user is banned!', user.userId);
        return;
    }
    var time = Date.now();
    if (this.message && this.message.time == time){
        util.log('warn', 'ChatManager.sendMessage', 'double messages in the same time!', time);
        return;
    }
    if (!target) target = this.default;
    this.message = {
        text: text,
        time: time,
        userId: user.userId,
        userName: (isAdmin?'admin':user.userName),
        admin:isAdmin,
        target: target,
        userData: user.getData()
    };
    this.server.storage.pushMessage(this.message);
    if (target != this.default) {
        this.server.router.send({
            module: 'chat_manager', type: 'message', target: user, data: this.message
        });
        target = this.server.storage.getUser(target);
    }
    if (target) this.server.router.send({
        module:'chat_manager', type: 'message', target: target, data:this.message
    });
};


ChatManager.prototype.loadMessages = function (user, count, time, target){
    if (count>20) count = 20; var self = this;
    this.server.storage.getMessages(count, time, target, target==this.default?null:user.userId)
        .then(function (messages) {
            self.server.router.send({
                module:'chat_manager', type: 'load', target: user, data:messages
            });
        })
        .catch(function (err) {
            util.log('err;', 'ChatManager.loadMessages', 'can not load messages', err);
            self.server.router.send({module:'chat_manager', type: 'load', target: user, data:[]});
        });
};


ChatManager.prototype.deleteMessage = function (){

};


ChatManager.prototype.banUser = function (userId, days, reason){
    util.log('log;', 'ChatManager.banUser', userId, days, reason);
    var timeEnd = Date.now() + days * 1000 * 3600 * 24;
    this.server.storage.banUser(userId, timeEnd, reason);
    var user = this.server.storage.getUser(userId);
    if (user) {
        user.isBanned = true;
        user.ban = {timeEnd: timeEnd, reason: reason};
        this.server.router.send({
            module: 'chat_manager', type: 'ban', target: user, data: user.ban
        });
    } else {
        util.log('warn;', 'ChatManager.banUser, user not found', userId);
    }
};