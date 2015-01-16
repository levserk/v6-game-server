//var EventEmitter = require('events').EventEmitter;
var util = require('util');

module.exports = ChatManager;

function ChatManager(server){
    this.server = server;
}


ChatManager.prototype.onMessage = function(message, type){
    switch (type){
        case 'message':
            this.sendMessage(message.sender, message.data.text, message.data.target, message.data.admin);
            break;
        case 'load':
            this.loadMessages(message.sender, 5, message.data.time);
            break;
    }
};


ChatManager.prototype.sendMessage = function(user, text, target, isAdmin){
    // TODO: check ban user, text length
    var time = Date.now();
    if (this.message && this.message.time == time){
        util.log('warn', 'ChatManager', 'double messages in the same time!', time);
        return;
    }
    if (!target) target = this.server.game;
    this.message = {
        text: text,
        time: time,
        userId: user.userId,
        userName: (isAdmin?'admin':user.userName),
        admin:isAdmin,
        target: target,
        userData: user.data
    };
    this.server.storage.pushMessage(this.message);

    this.server.router.send({
        module:'chat_manager', type: 'message', target: target, data:this.message
    });

};


ChatManager.prototype.loadMessages = function (user, count, time){
    if (count>20) count = 20;
    this.server.router.send({
        module:'chat_manager', type: 'load', target: user, data:this.server.storage.getMessages(count, time)
    });
};


ChatManager.prototype.deleteMessage = function (){

};


ChatManager.prototype.banUser = function (){

};