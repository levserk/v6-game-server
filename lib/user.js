var util = require('util');

module.exports = User;

function User(userId, socket){
    if (!userId || !socket) new Error("wrong user data");
    this.userId = userId;
    this.socket = socket;
    this.currentRoom = null;
    this.sessionId = socket.cookie.sessionId;
}

User.prototype.getInfo = function(modes){
    var data = {
        userId:this.userId,
        userName:this.userName
    };
    data[modes[0]] = this[modes[0]];
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


User.prototype.applyData = function(data ,modes){
    this.userName = data.userName;
    this[modes[0]] = data[modes[0]];
};