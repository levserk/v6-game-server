var EventEmitter = require('events').EventEmitter;
var util = require('util');
var logger = require('./logger.js');

module.exports = InviteManager;

function InviteManager(server){
    EventEmitter.call(this);

    this.server = server;
    this.invites = {};
    this.waiting = {};

    this.server.on("user_leave", function(user){
        this.removeWaitingUser(user);
        if (this.invites[user.userId]) delete this.invites[user.userId]
    }.bind(this));

}

util.inherits(InviteManager, EventEmitter);


InviteManager.prototype.onMessage = function(message, type){
    switch (type){
        case "invite": this.onInvite(message); break;
        case "cancel": this.onInviteCancel(message); break;
        case "accept": this.onInviteAccepted(message); break;
        case "reject": this.onInviteRejected(message); break;
        case "random": this.onPlayRandom(message.sender, message.data); break;
    }
};


InviteManager.prototype.onInvite = function(invite){
    // TODO: check invite can be send
    if (invite.target == invite.sender.userId){
        logger.warn('InviteManager.onInvite', 'user invite himself', invite.target, 1);
        return;
    }
    invite.data = invite.data || {};
    invite.data.mode = invite.data.mode || this.server.modes[0];
    invite.data.from = invite.sender.userId;
    var target = this.server.getUserById(invite.target);
    if (!target) {
        logger.warn('InviteManager.onInvite', 'no user', invite.target, 2);
        return;
    }
    if (this.server.gameManager.getUserRoom(invite.sender) || this.server.gameManager.getUserRoom(target)){
        logger.warn('InviteManager.onInvite', 'invite user already in room!', 2);
        return;
    }
    this.invites[invite.sender.userId] = invite.data;
    this.server.router.send({
        module : "invite_manager",
        type: "invite",
        sender:invite.sender,
        target:target,
        data:invite.data
    });
};


InviteManager.prototype.onInviteCancel = function(invite){
    var target = this.server.getUserById(invite.target);
    invite.data.from = invite.sender.userId;
    delete this.invites[invite.data.form];
    if (!target) {
        logger.warn('InviteManager.onInviteCancel', 'no user', invite.target, 2);
        return;
    }
    this.server.router.send({
        module : "invite_manager",
        type: "cancel",
        sender:invite.sender,
        target: target,
        data:invite.data
    });
};


InviteManager.prototype.onInviteAccepted = function(invite){
    var target = this.server.getUserById(invite.target);
    if (!target) {
        logger.warn('InviteManager.onInviteAccepted', 'no user', invite.target, 1);
        return;
    }
    if (this.server.gameManager.getUserRoom(invite.sender)){
        logger.log('InviteManager.onInviteAccepted', 'accepted user already in room', invite.sender.userId, 2);
        this.server.router.send({
            module : "invite_manager",
            type: "reject",
            sender: target,
            target: target,
            data: invite.data
        });
        return;
    }
    if (this.server.gameManager.getUserRoom(target)){
        logger.log('InviteManager.onInviteAccepted', 'sent user already in room', target.userId, 2);
        return;
    }

    if (!this.invites[target.userId]){
        logger.warn('InviteManager.onInviteAccepted', 'invite not exists, invite sender and accepted:', target.userId, target.isConnected, invite.sender.userId,  invite.sender.isConnected, 1);
        this.server.router.send({
            module : "invite_manager",
            type: "reject",
            sender: target,
            target: target,
            data: invite.data
        });
        return;
    }

    // check waiting user
    this.removeWaitingUser(target);
    this.removeWaitingUser(invite.sender);

    this.emit("invite_accepted", {
        owner:target,
        players:[target, invite.sender],
        data: this.invites[target.userId]
    });
    delete this.invites[target.userId];
};


InviteManager.prototype.onInviteRejected = function(invite){
    invite.data = invite.data || {};
    var target = this.server.getUserById(invite.target);
    if (!target) {
        logger.warn('InviteManager.onInviteRejected', 'no user', invite.target, 1);
        return;
    }
    this.server.router.send({
        module : "invite_manager",
        type: "reject",
        sender:invite.sender,
        target:target,
        data:invite.data
    });
    delete this.invites[target.userId];
};


InviteManager.prototype.onPlayRandom = function(user, data){
    logger.log('InviteManager.onRandomPlay', user?user.userId:null, data, 3);
    if (!user || !user.userId || !data) {
        logger.err('InviteManager.onRandomPlay wrong parameters', 1);
        return;
    }

    if (this.removeWaitingUser(user) == data.mode || data == 'off'){ // remove and check turn off
        return;
    }

    if (this.server.gameManager.getUserRoom(user)){
        logger.warn('InviteManager', 'random play user already in room!', 1);
        return;
    }

    var wrongMode = true;
    for (var i = 0; i < this.server.modes.length; i++){
        if (this.server.modes[i] == data.mode) {
            wrongMode = false;
            break;
        }
    }

    if (wrongMode){
        logger.err('InviteManager.onRandomPlay wrong game mode ', data.mode, 1);
        return;
    }

    if (this.waiting[data.mode]){ // there is user waiting random play
        if (this.server.gameManager.getUserRoom(this.waiting[data.mode])){
            logger.warn('InviteManager', 'waiting user already in room!', 1);
            this.waiting[data.mode] = user;
            return;
        }
        logger.log('InviteManager.onRandomPlay, start game', user.userId, this.waiting[data.mode].userId, 2);
        this.emit("invite_accepted", {
            owner: user,
            players:[user, this.waiting[data.mode]],
            data: data
        });
        this.waiting[data.mode] = null;
    } else {
        this.waiting[data.mode] = user;
    }
};


InviteManager.prototype.removeWaitingUser = function(user){
    for (var i = 0; i < this.server.modes.length; i++){
        if (this.waiting[this.server.modes[i]] == user){
            this.waiting[this.server.modes[i]] = null;
            logger.log('InviteManager.removeWaitingUser ', user.userId, this.server.modes[i], 3);
            return this.server.modes[i];
        }
    }
    return false;
};