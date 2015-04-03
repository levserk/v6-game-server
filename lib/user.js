var util = require('util');

module.exports = User;

function User(socket){
    if (!socket) new Error("wrong user data");
    this.userId = socket.cookie._userId;
    this.sign = socket.cookie._sign;
    this.socket = socket;
    this.currentRoom = null;
    this.sessionId = socket.cookie.sessionId;
    this.userName = socket.cookie._userName;
}

User.prototype.name = '__User__';

User.prototype.getInfo = function(mode){
    var data = {
        userId: this.userId,
        userName: this.userName,
        dateCreate: this.dateCreate
    };
    if (mode){
        data[mode] = this[mode];
    } else {
        for (var i = 0; i < this.__modes.length; i++)
            data[this.__modes[i]] = this[this.__modes[i]];
    }
    return data;
};

User.prototype.getData = function(){
    var data = {};
    for (var i = 0; i < this.__modes.length; i++)
        data[this.__modes[i]] = this[this.__modes[i]];
    return data;
};

User.prototype.enterRoom = function(room){
    if (this.currentRoom){
        throw new Error('user ' + this.userId + ' already in room! ' + this.currentRoom.id);
    }
    this.socket.enterRoom(room.id);
    this.currentRoom = room;
};


User.prototype.leaveRoom = function(){
    if (!this.currentRoom) {
        util.log('log; ', 'no rooms to leave!', this.userId);
        return;
    }
    if (this.isConnected) { // closed socket already leave room
        util.log('log; ', 'leaving room ', this.currentRoom.id, this.userId);
        this.socket.leaveRoom(this.currentRoom.id);
    }
    this.currentRoom = null;
};


User.prototype.applyData = function(data, modes){
    this.dateCreate = data.dateCreate;
    this.isBanned = data.isBanned;
    this.ban = data.ban;
    this.isAdmin = data.isAdmin || false;
    this.settings = data.settings;

    for (var i = 0; i < modes.length; i++)
        this[modes[i]] = data[modes[i]];
    this.__modes = modes;
};