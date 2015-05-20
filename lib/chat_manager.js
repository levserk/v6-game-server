var util = require('util');
var logger = require('./logger.js');

module.exports = ChatManager;

function ChatManager(server){
    this.server = server;
    this.default = server.game;
    this.MESSAGES_INTERVBAL = 1500;
}


ChatManager.prototype.onMessage = function(message, type){
    var data = message.data;
    switch (type){
        case 'message':
            if (data.admin && !message.sender.isAdmin){
                logger.warn('ChatManager.sendMessage', 'try send message not admin ',
                    message.sender.userId, message.sender.userName, data.text, 1);
                return;
            }
            this.sendMessage(message.sender, data.text, data.target, data.admin);
            break;
        case 'load':
            this.loadMessages(message.sender, data.count, data.time, data.target || this.default);
            break;
        case 'ban':
            if (message.sender.isAdmin || this.server.conf.mode == 'debug' || this.server.conf.mode == 'develop')
                this.banUser(data.userId, data.days, data.reason);
            break;
        case 'delete':
            if (message.sender.isAdmin || this.server.conf.mode == 'debug' || this.server.conf.mode == 'develop')
                this.deleteMessage(data.time);
            break;
    }
};


ChatManager.prototype.sendMessage = function(user, text, target, isAdmin){
    // TODO: check ban user, text length
    if (user.isBanned){
        logger.warn('ChatManager.sendMessage', 'user is banned!', user.userId, 1);
        return;
    }
    var time = Date.now();
    if (this.message && this.message.time == time){
        logger.warn('ChatManager.sendMessage', 'fast messages in the same time!', time, 1);
        return;
    }
    if (user.timeLastMessage && time - user.timeLastMessage < this.MESSAGES_INTERVBAL) {
        logger.warn('ChatManager.sendMessage', 'double messages in ', user.userId, user.userName, time - user.timeLastMessage, 2);
        return;
    }
    if (text.length > 128) {
        logger.warn('ChatManager.sendMessage', 'long messages in ', user.userId, user.userName, text.length, 1);
        return;
    }
    user.timeLastMessage = time;
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
    count = +count;
    if (!count || count > 100 || count < 0) count = 10;
    var self = this;
    this.server.storage.getMessages(count, time, target, target==this.default?null:user.userId)
        .then(function (messages) {
            self.server.router.send({
                module:'chat_manager', type: 'load', target: user, data:messages
            });
        })
        .catch(function (err) {
            logger.err('ChatManager.loadMessages', 'can not load messages', err, 1);
            self.server.router.send({module:'chat_manager', type: 'load', target: user, data:[]});
        });
};


ChatManager.prototype.deleteMessage = function (id){
    logger.log('ChatManager.deleteMessage', id, 2);
    this.server.storage.deleteMessage(id);
};


ChatManager.prototype.banUser = function (userId, days, reason){
    logger.log('ChatManager.banUser', userId, days, reason, 2);
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
        logger.warn('ChatManager.banUser, user not found', userId, 3);
    }
};