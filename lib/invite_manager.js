var EventEmitter = require('events').EventEmitter;
var util = require('util');

module.exports = InviteManager;

function InviteManager(server){
    EventEmitter.call(this);

    this.server = server;
    this.invites = {};

    this.server.on("user_leave", function(user){
        if (this.waiting == user) this.waiting = null;
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
        util.log('warn;', 'InviteManager.onInvite', 'user invite himself', invite.target);
        return;
    }
    invite.data = invite.data || {};
    invite.data.mode = invite.data.mode || this.server.modes[0];
    invite.data.from = invite.sender.userId;
    var target = this.server.getUserById(invite.target);
    if (!target) {
        util.log('warn;', 'InviteManager.onInvite', 'no user', invite.target);
        return;
    }
    if (this.server.gameManager.getUserRoom(invite.sender) || this.server.gameManager.getUserRoom(target)){
        util.log('warn;', 'InviteManager.onInvite', 'invite user already in room!');
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
    // TODO: check player in room
    if (this.server.gameManager.getUserRoom(invite.sender)){
        util.log('warn; ', 'InviteManager.onInviteAccepted', 'user already in room', invite.sender.userId);
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
    if (this.waiting == target || this.waiting == invite.sender)
        this.waiting = null;

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
    util.log('log;', 'InviteManager.onRandomPlay', user?user.userId:null, data);
    if (!user || !user.userId || !data) {
        util.log('err;', 'InviteManager.onRandomPlay wrong parameters');
        return;
    }

    if (this.waiting == user){
        this.waiting = null;
        return;
    }
    if (this.server.gameManager.getUserRoom(user)){
        util.log('warn;', 'InviteManager', 'random play user already in room!');
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
        util.log('err;', 'InviteManager.onRandomPlay wrong game mode ', data.mode);
        return;
    }

    if (this.waiting){ // there is user waiting random play
        if (this.server.gameManager.getUserRoom(this.waiting)){
            util.log('warn;', 'InviteManager', 'waiting user already in room!');
            this.waiting = user;
            return;
        }
        util.log('log;', 'InviteManager.onRandomPlay, start game', user.userId, this.waiting.userId);
        this.emit("invite_accepted", {
            owner: user,
            players:[user, this.waiting],
            data: data
        });
        this.waiting = null;
    } else {
        this.waiting = user;
    }
};