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
    }
};


ChatManager.prototype.sendMessage = function(user, text, target, isAdmin){
    // TODO: check ban user, text length
    var time = Date.now();
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
    //TODO: save message
    this.server.router.send({
        module:'chat_manager', type: 'message', target: target, data:this.message
    })

};


ChatManager.prototype.loadMessages = function (){

};


ChatManager.prototype.deleteMessage = function (){

};


ChatManager.prototype.banUser = function (){

};