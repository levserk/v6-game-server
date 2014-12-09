var EventEmitter = require('events').EventEmitter;
var Room = require('./room.js');
var util = require('util');

module.exports = GameManager;

function GameManager(server){
    EventEmitter.call(this);

    var self = this;
    this.server = server;
    this.engine = server.engine;

    // bindEvents
    server.on('user_leave', function(user){
        if (user.currentRoom) {
            self.onUserLeave(user.currentRoom, user);
        }
    });
    server.on('user_relogin', function(user){

    });
    server.inviteManager.on('invite_accepted', function(invite){
        util.log('log;', 'invite_accepted',invite.owner.userId);
        if (!invite.owner || !invite.players || invite.players.length<2){
            util.log('err;', 'game_manager;', 'wrong invite!', invite);
        }
        self.createGame(invite.owner, invite.players, invite.data);
    });
}

util.inherits(GameManager, EventEmitter);


GameManager.prototype.onMessage = function(message, type){
    var room;
    if (type != 'watch') room = this.getUserRoom(message.sender, true);
    else room = this.server.storage.getRoom(message.data.roomId);

    if (!room){
        util.log('err; ', 'GameManager', 'no room to continue', message);
        return;
    }

    switch (type){
        case 'ready': // player ready to play
            this.setUserReady(room, message.sender, message.data);
            break;
        case 'turn': // all players turns
            this.onUserTurn(room, message.sender, message.data);
            break;
        case 'throw': // player capitulation
            break;
        case 'event': // all events, draw, turn back, others
            this.onUserEvent(room, message.sender, message.data);
            break;
        case 'watch': // user begin spectate
            this.onUserWatch(room, message.sender);
            break;
        case 'leave': // user leave room
            this.onUserLeave(room, message.sender);
            break;
    }
};


GameManager.prototype.createGame = function(owner, players, data){
    var type = 1 || data.gameType;
    var room = this.createRoom(owner, players, type);
    var userData = this.initGame(room);

    this.server.router.send({
        module: 'server',
        type: 'new_game',
        target: {room: this.server.game},
        data: {players:room.getPlayersId(), room:room.id}
    });

    this.server.router.send({
        module: 'game_manager',
        type: 'game_start',
        target: {room: room.id},
        data: userData
    });

    this.server.storage.pushRoom(room);
};


GameManager.prototype.createRoom = function(owner, players, type){
    var id = this.generateRoomId(owner, type);
    var room = new Room(id, owner, players, type);

    for (var i = 0; i < players.length; i++) {
        players[i].enterRoom(room);
    }

    return room;
};


GameManager.prototype.setUserReady = function(room, user, ready){

};


GameManager.prototype.onUserTurn = function(room, user, turn){

};


GameManager.prototype.onUserEvent = function(room, user, event){

};


GameManager.prototype.onUserWatch = function(room, user){

};


GameManager.prototype.onUserLeave = function(room, user){
    //TODO: round end; save result in other function;
    util.log('log;', 'GameManager.onUserLeave', user.userId);
    this.server.router.send({
        module: 'game_manager',
        type: 'user_leave',
        target: {room: room.id},
        data: user.userId
    });

    util.log('log;', 'closeRoom', room.id);
    for (var i = 0; i < room.players.length; i++) room.players[i].leaveRoom();
    this.server.storage.popRoom(room);

    this.server.router.send({
        module: 'server',
        type: 'end_game',
        target: {room: this.server.game},
        data: {players:room.getPlayersId(), room:room.id}
    });
};


GameManager.prototype.initGame = function(room) {
    var userData = {};
    // TODO: async initGame and error handler
    if (typeof this.engine.initGame == "function") userData = userData || this.engine.initGame(room);
    else {
        userData.first = room.owner.userId;
    }
    userData.id = room.id;
    userData.owner = room.owner.userId;
    userData.players = [];
    for (var i = 0; i < room.players.length; i++) userData.players.push(room.players[i].userId);
    return userData;
};


GameManager.prototype.getUserRoom = function(user, notSpectator){
    if (typeof notSpectator != "boolean") notSpectator = true;
    if (!user.currentRoom) return null;
    if (!notSpectator) return user.currentRoom;
    if (user.currentRoom.players.indexOf(user) != -1) return user.currentRoom;
    else {
        util.log('warn; ', 'user is not a player in room!', user.currentRoom, user);
        return null;
    }
};


GameManager.prototype.generateRoomId = function(owner, type){
    //game format name: "game_type_userId_socketId_hh.mm.ss"
    var now = new Date();
    return this.server.game + type + "_" + owner.userId + "_" + owner.socket.id
        + "_" + now.getHours() + "." + now.getMinutes() + "." + now.getSeconds();
};