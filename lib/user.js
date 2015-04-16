var util = require('util');
var logger = require('./logger.js');

module.exports = User;

function User(socket, userData){
    this.userId = userData.userId ? userData.userId + '' : null;
    this.userName = userData.userName ? userData.userName + '' : null;
    this.sign = userData.sign ? userData.sign + '' : null;
    this.socket = socket;
    this.currentRoom = null;
    this.settings = {};
    this.lastTimeSendInfo = Date.now();
}

User.prototype.name = '__User__';

User.prototype.getInfo = function(mode){
    var data = {
        userId: this.userId,
        userName: this.userName,
        dateCreate: this.dateCreate,
        disableInvite: this.settings.disableInvite || false
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
        logger.warn('no rooms to leave!', this.userId, 1);
        return;
    }
    if (this.isConnected) { // closed socket already leave room
        logger.log('log; ', 'leaving room ', this.currentRoom.id, this.userId, 3);
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