var EventEmitter = require('events').EventEmitter;
var util = require('util');

module.exports = InviteManager;

function InviteManager(server){
    EventEmitter.call(this);

    this.server = server;

    //bind events
    this.server.on("user_leave", function(user){
        // TODO: cancel or reject invite; ??
    });
}

util.inherits(InviteManager, EventEmitter);


InviteManager.prototype.onMessage = function(message, type){
    switch (type){
        case "invite": this.onInvite(message); break;
        case "cancel": this.onInviteCancel(message); break;
        case "accept": this.onInviteAccepted(message); break;
        case "reject": this.onInviteRejected(message); break;
    }
};


InviteManager.prototype.onInvite = function(invite){
    // TODO: check invite can be send
    invite.data = invite.data || {};
    invite.data.gameType = invite.data.gameType || 1;
    invite.data.from = invite.sender.userId;
    var target = this.server.getUserById(invite.target);
    this.server.router.send({
        module : "invite_manager",
        type: "invite",
        sender:invite.sender,
        target:{user: target},
        data:invite.data
    });
};


InviteManager.prototype.onInviteCancel = function(invite){
    var target = this.server.getUserById(invite.target);
    invite.data.from = invite.sender.userId;
    this.server.router.send({
        module : "invite_manager",
        type: "cancel",
        sender:invite.sender,
        target:{user: target},
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
            sender:target,
            target:{user: target},
            data:invite.data
        });
        return;
    }
    this.emit("invite_accepted", {
        owner:target,
        players:[target, invite.sender],
        data: invite.data
    });
};


InviteManager.prototype.onInviteRejected = function(invite){
    invite.data = invite.data || {};
    var target = this.server.getUserById(invite.target);
    this.server.router.send({
        module : "invite_manager",
        type: "reject",
        sender:invite.sender,
        target:{user: target},
        data:invite.data
    });
};
