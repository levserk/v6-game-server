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
    delete data.from;
    delete data.target;
    var room = this.createRoom(owner, players, data);
    var info = room.getInfo();

    this.server.router.send({
        module: 'server',
        type: 'new_game',
        target: {room: this.server.game},
        data: info
    });

    this.server.storage.pushRoom(room);
};


GameManager.prototype.createRoom = function(owner, players, data){
    var id = this.generateRoomId(owner, data.gameType);
    var room = new Room(id, owner, players, data);

    for (var i = 0; i < players.length; i++) {
        players[i].enterRoom(room);
    }

    return room;
};


GameManager.prototype.setUserReady = function(room, user, ready){
    util.log('log;', 'GameManager.setUserReady room:', room.id, 'user:',  user.userId, ready);
    if (typeof ready != "boolean") ready = true;
    if (room.game.state != "waiting") {
        util.log('err;', 'GameManager.setUserReady', 'game already started!', room, user.userId, ready);
        return;
    }
    room.data[user.userId].ready = ready;

    this.server.router.send({
        module: 'game_manager',
        type: 'ready',
        target: {room: room.id},
        data: {
            user:user.userId,
            ready:ready
        }
    });

    if (room.checkPlayersReady()){ // all users ready
        // initializing game before start, and get data to send players
        var userData = this.initGame(room);
        room.game.state = "playing";

        this.server.router.send({
            module: 'game_manager',
            type: 'round_start',
            target: {room: room.id},
            data: userData
        });
    }
};


GameManager.prototype.onUserTurn = function(room, user, turn){
    util.log('log;', 'GameManager.onUserTurn room:', room.id, 'user:',  user.userId);
    if (room.game.state != 'playing'){
        this.sendError(user, 'game_not_started!');
        return;
    }
    // check user is current, check turn is valid, ask engine what to do, send to all in room
    if (room.game.current != user) { // wrong user
        this.sendError(user, 'not_your_turn');
        return;
    }

    // do turn in engine
    var userTurn;
    if (typeof this.engine.doTurn == "function") userTurn = this.engine.doTurn(room, user, turn);
    else userTurn = turn;
    if (!userTurn) { // wrong turn
        this.server.router.send({
            module: 'game_manager',
            type: 'error',
            target: {user: user},
            data: 'wrong_turn'
        });
        return;
    }

    // switch player
    var nextPlayer;
    if (typeof this.engine.switchPlayer == "function") nextPlayer = this.engine.switchPlayer(room, user, turn);
    else {
        for (var i = 0; i < room.players.length; i++)
        if (room.players[i] != user) {
            nextPlayer = room.players[i];
            break;
        }
    }

    // send turn
    this.server.router.send({
        module: 'game_manager',
        type: 'turn',
        target: {room: room.id},
        data: {user:user.userId, turn:userTurn}
    });

    // check endGame
    if (!this.checkGameEnd(room, user, turn) && nextPlayer != room.game.current) {// switch
        room.game.current = nextPlayer
    }
};


GameManager.prototype.checkGameEnd = function(room, user, turn){
    var result = false; // false - game not end, null - draw, user - winner
    if (typeof this.engine.getGameResult == "function") result = this.engine.getGameResult(room, user, turn);
    else {
        if (turn == 'win')
            result = { winner: user };
        else if (turn == 'draw')
            result = {winner: null };
    }
    if (result) { // game end
        this.onRoundEnd(room, result);
        return true;
    }
    return false;
};


GameManager.prototype.onUserEvent = function(room, user, event){
    // check event type, throw, ask draw, ask moveback
    if (room.game.state != "playing") {
        util.log('error', 'event in not started game room:', room.id, user.userId);
        this.sendError(user, 'event in not started game room: ' + room.id);
        return;
    }
    if (event == 'throw'){ // user throw
        for (var i = 0; i < room.players.length; i++)
            if (room.players[i] != user) {
                this.onRoundEnd(room, {
                    winner: room.players[i],
                    action: 'throw'
                });
                return;
            }
    }
};


GameManager.prototype.onUserWatch = function(room, user){

};


GameManager.prototype.onUserLeave = function(room, user){
    //TODO: round end; save result in other function;
    util.log('log;', 'GameManager.onUserLeave', user.userId);
    var i;

    // other user win if game start
    if (room.game.state == "playing")
    for (i = 0; i < room.players.length; i++)
        if (room.players[i] != user) {
            this.onRoundEnd(room, {
                winner: room.players[i],
                action: 'user_leave'
            });
            break;
        }

    this.server.router.send({
        module: 'game_manager',
        type: 'user_leave',
        target: {room: room.id},
        data: user.userId
    });

    util.log('log;', 'closeRoom', room.id);
    for (i = 0; i < room.players.length; i++) room.players[i].leaveRoom();
    this.server.storage.popRoom(room);

    this.server.router.send({
        module: 'server',
        type: 'end_game',
        target: {room: this.server.game},
        data: {players:room.getPlayersId(), room:room.id}
    });
};


GameManager.prototype.onRoundEnd = function(room, result){
    util.log('log;', 'GameManager.onRoundEnd, room:', room.id, 'result:', result.winner, result.action);

    // TODO: save results
    if (result.save) {
        // TODO: get new score, ratings
    }

    if (result.winner && result.winner.userId)
        result.winner = result.winner.userId;

    room.game.state = "waiting";
    for (var i = 0; i < room.players.length; i++){
        room.data[room.players[i].userId].ready = false;
    }

    this.server.router.send({
        module: 'game_manager',
        type: 'round_end',
        target: {room: room.id},
        data: result
    });
};


GameManager.prototype.initGame = function(room) {
    var userData = room.inviteData || {};
    // TODO: async initGame and error handler
    if (typeof this.engine.initGame == "function") userData = this.engine.initGame(room) || userData;
    if (typeof this.engine.setFirst == "function") room.game.current =  this.engine.setFirst(room);
    else  room.game.current = room.owner;
    if (!room.game.current || !room.game.current.userId){
        throw new Error('first player is undefined! '+room.id)
    }
    room.game.first = room.game.current;
    userData.first = room.game.current.userId;
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


GameManager.prototype.sendError = function(user, error){
    this.server.router.send({
        module: 'game_manager',
        type: 'error',
        target: {user: user},
        data: error
    });
};


GameManager.prototype.generateRoomId = function(owner, type){
    //game format name: "game_type_userId_socketId_hh.mm.ss"
    var now = new Date();
    return this.server.game + type + "_" + owner.userId + "_" + owner.socket.id
        + "_" + now.getHours() + "." + now.getMinutes() + "." + now.getSeconds();
};