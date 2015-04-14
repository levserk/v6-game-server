var EventEmitter = require('events').EventEmitter;
var Room = require('./room.js');
var util = require('util');

module.exports = GameManager;

function GameManager(server){
    EventEmitter.call(this);

    this.server = server;
    this.engine = server.engine;
    this.defaultEngine = server.defaultEngine;
    this.turnTime = server.conf.turnTime * 1000;
    this.maxTimeouts = server.conf.maxTimeouts;
    this.minTurns = server.conf.minTurns;

    // bindEvents
    server.on('user_leave', this.onUserDisconnect.bind(this));
    server.on('user_relogin', this.onUserRelogin.bind(this));
    server.inviteManager.on('invite_accepted', this.onInviteAccepted.bind(this));
}

util.inherits(GameManager, EventEmitter);


GameManager.prototype.onMessage = function(message, type){
    var room;
    if (type == 'spectate') {
        room = this.server.storage.getRoom(message.data.roomId);
    } else room = this.getUserRoom(message.sender, type != 'leave');

    if (!room){
        util.log('err; ', 'GameManager', 'no room to continue', message);
        this.sendError(message.sender, 'no room!');
        return;
    }

    switch (type){
        case 'ready': // player ready to play
            this.setUserReady(room, message.sender, message.data);
            break;
        case 'turn': // all players turns
            this.onUserTurn(room, message.sender, message.data);
            break;
        case 'event': // all events, draw, throw, turn back, others
            this.onUserEvent(room, message.sender, message.data);
            break;
        case 'spectate': // user begin spectate
            this.onUserSpectate(room, message.sender);
            break;
        case 'leave': // user leave room
            if (room.players.indexOf(message.sender) != -1)
                this.onUserLeave(room, message.sender);
            else
                if (room.spectators.indexOf(message.sender) != -1) this.onSpectatorLeave(room, message.sender);
                else util.log('err', 'GameManager.onMessage leave', 'user not a player and not a spectator in room', room.id);
            break;
    }
};


GameManager.prototype.onUserDisconnect = function(user){
    var room = this.getUserRoom(user, true);    // get room where user is player
    if (room && (!room.isPlaying() || this.server.conf.loseOnLeave)) {
        this.onUserLeave(user.currentRoom, user);
    }
    if (!room){
        room = this.getSpectatorRoom(user);   // get room where user is spectator
        if (room){
            this.onSpectatorLeave(room, user);
        }
    }
};


GameManager.prototype.onUserRelogin = function(user){
    var room = user.currentRoom;
    if (room) {
        user.socket.enterRoom(room.id); // new socket enter game room
        this.server.router.send({
            module: 'game_manager',
            type: 'game_restart',
            target: user,
            data: room.getGameData()
        });
        room.game.askDraw = null;
        if (!this.server.conf.reconnectOldGame || !room.isPlaying())
            this.onUserLeave(room, user);
    }
};


GameManager.prototype.onInviteAccepted = function(invite){
    util.log('log;', 'invite_accepted',invite.owner.userId);
    if (!invite.owner || !invite.players || invite.players.length<2){
        util.log('err;', 'GameManager;', 'wrong invite!', invite);
    }
    // leave spectators room
    var player;
    for (var i = 0; i < invite.players.length; i++){
        player = invite.players[i];
        if (this.getSpectatorRoom(player)){
            this.onSpectatorLeave(player.currentRoom, player);
        }
    }

    this.createGame(invite.owner, invite.players, invite.data);
};


GameManager.prototype.createGame = function(owner, players, data){
    delete data.from;
    delete data.target;
    if (!data.mode) throw new Error('game mode undefined!');
    var room = this.createRoom(owner, players, data);
    var info = room.getInfo();

    this.server.router.send({
        module: 'server',
        type: 'new_game',
        target: this.server.game,
        data: info
    });

    this.server.storage.pushRoom(room);
};


GameManager.prototype.createRoom = function(owner, players, data){
    var id = this.generateRoomId(owner, data.mode);
    var room = new Room(id, owner, players, data);
    room.saveHistory = data.saveHistory !== false;
    room.saveRating = data.saveRating !== false;
    room.turnTime = data.turnTime*1000 || this.turnTime;
    if (!room.turnTime || room.turnTime<0) room.turnTime = this.turnTime;
    room.takeBacks = +data.takeBacks || 0;
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
        target: room,
        data: {
            user:user.userId,
            ready:ready
        }
    });

    if (room.checkPlayersReady()){ // all users ready
        // initializing game before start, and get data to send players
        var game = room.game;
        game.initData = this.initGame(room);
        game.state = "playing";
        game.history = [];
        game.shistory = "";
        game.playerTurns = [];

        this.server.router.send({
            module: 'game_manager',
            type: 'round_start',
            target: room,
            data: game.initData
        });

        if (typeof this.engine.gameEvent == "function") this.sendEvent(room, this.engine.gameEvent(room, null, null, true));
    }
};


GameManager.prototype.initGame = function(room) {
    var userData = {
        inviteData: room.inviteData
    };
    // TODO: async initGame and error handler
    if (typeof this.engine.initGame == "function")
        userData = this.engine.initGame(room) || userData;
    if (typeof this.engine.setFirst == "function")
        room.game.first =  this.engine.setFirst(room);
    else
        room.game.first = this.defaultEngine.setFirst(room);
    if (!room.game.first || !room.game.first.userId){
        throw new Error('first player is undefined! '+ room.id)
    }
    room.game.current = room.game.first;
    room.game.askDraw = null;
    room.game.turns = 0;
    room.game.timeStart = Date.now();
    room.game.turnTime = null;
    userData.first = room.game.current.userId;
    userData.id = room.id;
    userData.owner = room.owner.userId;
    userData.players = [];
    userData.score = room.getScore();
    userData.turnTime = room.turnTime;
    userData.saveHistory = room.saveHistory;
    userData.saveRating = room.saveRating;
    for (var i = 0; i < room.players.length; i++) userData.players.push(room.players[i].userId);
    return userData;
};


GameManager.prototype.onUserTurn = function(room, user, turn){
    util.log('log;', 'GameManager.onUserTurn room:', room.id, 'user:',  user.userId);
    var game = room.game;
    if (game.state != 'playing'){
        this.sendError(user, 'game_not_started!');
        return;
    }
    // check user is current, check turn is valid, ask engine what to do, send to all in room
    if (game.current != user) { // wrong user
        this.sendError(user, 'not_your_turn');
        return;
    }

    // do turn in engine
    var userTurn;
    if (typeof this.engine.doTurn == "function") userTurn = this.engine.doTurn(room, user, turn);
    else userTurn = turn;
    if (!userTurn || typeof userTurn != "object") { // wrong turn
        util.log('err;', 'GameManager.onUserTurn, wrong turn: ', userTurn);
        this.server.router.send({
            module: 'game_manager',
            type: 'error',
            target: user,
            data: 'wrong_turn'
        });
        return;
    }

    // switch player
    var nextPlayer = this.switchPlayer(room, user, turn);
    game.playerTurns.push(userTurn);
    if (nextPlayer != game.current ) {  // if switch player
        if (room.timeout) clearTimeout(room.timeout);
        room.data[game.current.userId].timeouts = 0;
        turn.nextPlayer = nextPlayer.userId;
        room.game.turns++;
        this.savePlayerTurn(room);
    }

    // send turn
    this.server.router.send({
        module: 'game_manager',
        type: 'turn',
        target:  room,
        data: {user:user.userId, turn:userTurn}
    });

    // check endGame
    if (!this.checkGameEnd(room, user, turn) && nextPlayer != game.current) {// switch and check event

        if (typeof this.engine.gameEvent == "function")                     // send event
            this.sendEvent(room, this.engine.gameEvent(room, user, turn, false));

        game.current = nextPlayer;
        game.turnTime = Date.now();
        room.timeout = setTimeout(function (){
            this.onTimeout(room, room.game.current);
        }.bind(this), room.turnTime)
    }
};


GameManager.prototype.switchPlayer = function(room, user, turn){
    var nextPlayer;
    if (typeof this.engine.switchPlayer == "function") nextPlayer = this.engine.switchPlayer(room, user, turn);
    if (!nextPlayer) nextPlayer = this.defaultEngine.switchPlayer(room, user, turn);
    return nextPlayer;
};


GameManager.prototype.checkGameEnd = function(room, user, turn){
    var result = false; // false - game not end, null - draw, user - winner
    if (typeof this.engine.getGameResult == "function")
        result = this.engine.getGameResult(room, user, turn);
    else
        result = this.defaultEngine.getGameResult(room, user, turn);
    if (result) { // game end
        this.savePlayerTurn(room);
        this.onRoundEnd(room, result);
        return true;
    }
    return false;
};


GameManager.prototype.savePlayerTurn = function(room){
    var game = room.game;
    if (game.playerTurns.length == 1) game.playerTurns = game.playerTurns[0];
    game.history.push(game.playerTurns);
    try{
        if (game.playerTurns.length == undefined || game.playerTurns.length > 0) {
            if (game.shistory.length>0)  game.shistory += '@';
            game.shistory += JSON.stringify(game.playerTurns);
        }
    } catch (e){
        util.log('error;', 'GameManager.savePlayerTurn', 'json stringify error!', game.playerTurns,  e)
    }
    game.playerTurns = [];
};


GameManager.prototype.saveEvent = function(room, target, event){
    if (target.name == '__User__')
        event.target = target.userId;
    else event.target = 'room';

    var game = room.game;
    game.history.push(event);
    try{
        if (game.shistory.length > 0)  game.shistory += '@';
        game.shistory += JSON.stringify(event);
    } catch (e){
        util.log('error;', 'GameManager.savePlayerTurn', 'json stringify error!', game.playerTurns,  e)
    }
};


GameManager.prototype.onUserEvent = function(room, user, event){
    // check event type, throw, ask draw, ask moveback
    if (room.game.state != "playing") {
        util.log('error', 'event in not started game room:', room.id, user.userId);
        this.sendError(user, 'event in not started game room: ' + room.id);
        return;
    }
    if (!event.type) {
        util.log('error', 'wrong event type ', room.id, user.userId);
        this.sendError(user, 'wrong event type room: ' + room.id);
        return;
    }
    switch (event.type){
        case 'throw': this.onThrow(room, user, event.type); break;
        case 'draw': this.onDraw(room, user, event); break;
        case 'back': this.onTakeBack(room, user, event); break;
        default:
            util.log('log;', 'GameManager.onUserEvent', event.type, user.userId);
            if (typeof this.engine.userEvent == "function"){
                this.sendEvent(room, this.engine.userEvent(room, user, event));
            }
    }
};


GameManager.prototype.sendEvent = function(room, data) {
    if (!data) return;

    if (data.length > 0) { // array of users and their events
        for (var i = 0; i < data.length; i++) {
            this.sendEvent(room, data[i], true);
        }
        return;
    }

    if (data.target) {
        if (!data.event || !data.event.type) {
            util.log('warn;', 'GameManager.sendEvent', 'wrong event', data);
            return;
        }

        this.saveEvent(room, data.target, data.event);

        this.server.router.send({
            module: 'game_manager',
            type: 'event',
            target: data.target,
            data: data.event
        });
    }
};


GameManager.prototype.onThrow = function(room, user, event){
    event = event || 'throw';
    for (var i = 0; i < room.players.length; i++)
        if (room.players[i] != user) {
            this.onRoundEnd(room, {
                winner: room.players[i],
                action: event
            });
            return;
        }
};


GameManager.prototype.onDraw = function(room, user, event){
    // TODO: check user can ask draw
    switch (event.action){
        case 'ask':
            if (!room.game.askDraw) {
                room.game.askDraw = user;
                this.server.router.send({
                    module: 'game_manager',
                    type: 'event',
                    target: room,
                    data: {
                        user: user.userId,
                        type: 'draw',
                        action: 'ask'
                    }
                });
            } else {
                if (room.game.askDraw == user) { // already asked
                    util.log('log;', 'GameManager.onDraw', 'user already ask draw', user.userId);
                } else { // draw
                    util.log('log;', 'GameManager.onDraw', 'auto draw', user.userId, room.game.askDraw.userId);
                    this.onRoundEnd(room, {action: 'draw'});
                }
            }
            break;
        case 'cancel':
            if (room.game.askDraw && room.game.askDraw != user) {
                this.server.router.send({
                    module: 'game_manager',
                    type: 'event',
                    target: room.game.askDraw,
                    data: {
                        user: user.userId,
                        type: 'draw',
                        action: 'cancel'
                    }
                });
                room.game.askDraw = null;
            } else {
                util.log('warn;', 'GameManager.onDraw', 'wrong cancel draw', user.userId, room.game.askDraw);
            }
            break;
        case 'accept':
            if (room.game.askDraw && room.game.askDraw != user) {
                util.log('log;', 'GameManager.onDraw', 'draw', user.userId, room.game.askDraw.userId);
                this.onRoundEnd(room, {action: 'draw'});
                room.game.askDraw = null;
            } else {
                util.log('warn;', 'GameManager.onDraw', 'wrong accept draw', user.userId, room.game.askDraw);
            }
            break;
    }

};


GameManager.prototype.onTakeBack = function(room, user, event){
    switch (event.action) {
        case 'take':
            if (true || room.userData[userId].takeBacks < room.takeBacks){ // doTakeBack
                this.doTakeBack(room, user);
            } else { // ask

            }
            break;
        case 'accept':
            break;
        case 'cancel':
            break;

    }
};


GameManager.prototype.doTakeBack = function(room, user) {
    var game = room.game;
    if (user == room.current && game.playerTurns.length>0){
        game.playerTurns = [];
        this.sendTakeBack(room, user);
    } else {
        if (game.history.length > 0 && game.turns > 0){
            for (var i = game.history.length - 2; i >= 0; i--) { // find previous user turn
                var turn = game.history[i];
                if (turn.length > 0) turn = turn[turn.length - 1];
                if (turn.nextPlayer == user.userId){
                    break;
                }
                if (i == 0) i = -1;
            }
            var count = game.history.length - i - 1;
            if (i < 0){  // user was first, cut all turns
                if (game.first == user)
                    count = game.turns;
                else count = 0;
            }
            util.log('log;', 'GameManager.onTakeBack; cut count:', count, ' total turns: ', game.turns, 'history length:', game.history.length, i);
            util.log('log;', 'GameManager.onTakeBack; shistory', game.shistory);
            if (count > 0) { // cut turns
                for (var j = 0; j < count; j++) {
                    game.shistory = game.shistory.substring(0, game.shistory.lastIndexOf('@'))
                }
                util.log('log;', 'GameManager.onTakeBack; shistory', game.shistory);
                game.history.splice(i, count);
                game.turns -= count;
                game.playerTurns = [];
                game.current = user;
                clearTimeout(room.timeout);
                game.turnTime = Date.now();
                room.timeout = setTimeout(function () {
                    this.onTimeout(room, room.game.current);
                }.bind(this), room.turnTime);
                this.sendTakeBack(room, user);
            }
        }
    }
};


GameManager.prototype.sendTakeBack = function(room, user){
    this.server.router.send({
        module: 'game_manager',
        type: 'event',
        target: room.id,
        data: {
            user: user.userId,
            history: room.game.shistory,
            type: 'back',
            action: 'take'
        }
    });
};


GameManager.prototype.onTimeout = function(room, user){
    room.data[user.userId].timeouts++;
    clearTimeout(room.timeout);
    util.log('log;', 'GameManager.onTimeout;', room.id, user.userId, room.data[user.userId].timeouts);
    if (!room.hasOnlinePlayer()){
        this.onThrow(room, user, 'timeout');
        return;
    }
    // player auto skip turn, switch players
    var nextPlayer = this.switchPlayer(room, user, 'timeout');

    this.server.router.send({
        module: 'game_manager',
        type: 'event',
        target: room.id,
        data: {
            user: user.userId,
            type: 'timeout',
            nextPlayer: nextPlayer.userId
        }
    });
    if (room.data[user.userId].timeouts == this.maxTimeouts) { // lose
        this.onThrow(room, user, 'timeout');
    } else {
        room.game.playerTurns.push({user: user.userId, action: 'timeout', nextPlayer: nextPlayer.userId});
        this.savePlayerTurn(room);
        room.game.current = nextPlayer;
        room.timeout = setTimeout(function () {
            this.onTimeout(room, room.game.current);
        }.bind(this), room.turnTime)
    }
};


GameManager.prototype.onUserSpectate = function(room, user){
    if (!this.server.conf.spectateEnable) return;
    if (this.getUserRoom(user, false)){
        util.log('err;', 'GameManager.onUserSpectate', 'user already in room ', user.currentRoom.id);
        return;
    }
    room.spectators.push(user);
    user.enterRoom(room);
    // send user room data
    this.server.router.send({
        module: 'game_manager',
        type: 'spectate',
        target: user,
        data: room.getGameData()
    });

    this.server.router.send({
        module: 'game_manager',
        type: 'spectator_join',
        target: room,
        data: {
            user: user.userId,
            room: room.id
        }
    });
};


GameManager.prototype.onSpectatorLeave = function(room, user){
    util.log('log;', 'GameManager.onSpectatorLeave', user.userId, room.id);
    for (var i = 0; i < room.spectators.length; i++){
        if (room.spectators[i].userId == user.userId) {
            room.spectators.splice(i, 1);
                try { // users can leave room and room will be closed before round spectate stop
                    this.server.router.send({
                        module: 'game_manager',
                        type: 'spectator_leave',
                        target: room,
                        data: {
                            user: user.userId,
                            room: room.id
                        }
                    });
                } catch (e) {
                    util.log('err;', 'GameManager.onSpectatorLeave, err:', e);
                }
            user.leaveRoom();
            return;
        }
    }
};


GameManager.prototype.onUserLeave = function(room, user){
    util.log('log;', 'GameManager.onUserLeave', user.userId, room.id);
    var i, result;
    // other user win if game start
    if (room.game.state == "playing")
    for (i = 0; i < room.players.length; i++)
        if (room.players[i] != user) {
           result =  {
                winner: room.players[i],
                action: 'user_leave'
            };
            break;
        }
    this.onRoundEnd(room, result, function(){
        if (room.hasOnlinePlayer() || room.spectators.length > 0) // check room isn't empty
            try { // users can leave room and room will be closed before round result send
                this.server.router.send({
                    module: 'game_manager',
                    type: 'user_leave',
                    target: room,
                    data: user.userId
                });
            } catch (e) {
                util.log('err;', 'GameManager.onUserLeave, err:', e);
            }
        else {
            util.log('warn;', 'GameManager.onUserLeave, room:', room.id, 'no players online');
        }

        util.log('log;', 'closeRoom', room.id);
        for (i = 0; i < room.players.length; i++) room.players[i].leaveRoom();
        for (i = 0; i < room.spectators.length; i++) room.spectators[i].leaveRoom();
        this.server.storage.popRoom(room);

        this.server.router.send({
            module: 'server',
            type: 'end_game',
            target: this.server.game,
            data: {players:room.getPlayersId(), room:room.id}
        });
    }.bind(this));
};


GameManager.prototype.onRoundEnd = function(room, result, callback){
    if (room.game.state != "playing") {
        util.log('log;', 'GameManager.onRoundEnd, room:', room.id, 'not playing! on user leave');
        if (callback) callback();
        return;
    }
    var self = this;
    if (room.timeout) clearTimeout(room.timeout);
    room.timeout = null;
    if (typeof this.engine.getUsersScores == "function") result = this.engine.getUsersScores(room, result);
    if (result.winner && result.winner.userId)
        result.winner = result.winner.userId;
    result.save = result.save || room.game.turns >= this.minTurns;
    result.action = result.action || 'game_over';
    util.log('log;', 'GameManager.onRoundEnd, room:', room.id, 'winner:', result.winner,
            'action:', result.action, 'save: ', result.save,
            'saveHistory:', room.saveHistory, 'saveRating:', room.saveRating, room.turnTime!=this.turnTime?'turnTime: '+room.turnTime :'');
    room.game.state = "waiting";
    if (this.server.isDevelop) {
        result.history = room.game.history;
        result.shistory = room.game.shistory;
    }

    if (result.save) {
        room.games++;
        if (result.winner) room.data[result.winner].win++;
        this.server.ratingManager.computeNewRatings(room, result, function(){
            util.log('log;', 'GameManager ratings computed');
            self.sendGameResult(room, result, callback);
        });
    } else {
        this.sendGameResult(room, result, callback);
    }
};


GameManager.prototype.sendGameResult = function(room, result, callback){
    util.log('log;', 'GameManager.sendGameResult, room:', room.id, result.action);
    result.score = room.getScore();
    result.ratings = {};
    result.saveHistory = room.saveHistory;
    result.saveRating = room.saveRating;

    var user, i;
    for (i = 0; i < room.players.length; i++){
        user = room.players[i];
        room.data[user.userId].ready = false;
        room.data[user.userId].timeouts = 0;
        room.data[user.userId].takeBacks = 0;
        result.ratings[user.userId] = user[room.mode];
    }

    this.saveGame(room, result);

    if (room.hasOnlinePlayer() || room.spectators.length > 0) // check room isn't empty
        try{ // users can leave room and room will be closed before round result send
            this.server.router.send({
                module: 'game_manager',
                type: 'round_end',
                target: room,
                data: result
            });
        } catch (e) {
            util.log('err;', 'GameManager.sendGameResult, err:', e);
        }
    else {
        util.log('warn;', 'GameManager.sendGameResult, room:', room.id, 'no players online');
    }

    if (callback) callback();
    for (i = 0; i < room.players.length; i++) {
        if (!room.players[i].isConnected && !room.players[i].isRemoved) this.server.onUserLeave(room.players[i]);
    }
};


GameManager.prototype.saveGame = function(room, result){
    if (!result.save || !room.saveHistory) return;
    var save = {}, game = room.game, userData = {};
    save.timeStart = game.timeStart;
    save.timeEnd = Date.now();
    save.winner = result.winner;
    save.action = result.action;
    save.roomId = room.id;
    save.mode = room.mode;
    save.history = game.shistory;
    save.players = game.initData.players;
    game.initData.players = undefined;
    game.initData.score = undefined;
    try{
        save.initData = JSON.stringify(game.initData);
    } catch (e){
        util.log('err;', 'GameManager.saveGame initData, error: ', e);
        save.initData = 'error';
    }
    try{
        save.score = JSON.stringify(result.score);
    } catch (e){
        util.log('err;', 'GameManager.saveGame score, error: ', e);
        save.score = 'error';
    }
    try{
        for (var i = 0; i < room.players.length; i++)
            userData[room.players[i].userId] = room.players[i].getInfo(room.mode);
        save.userData = JSON.stringify(userData);
    } catch (e){
        util.log('err;', 'GameManager.saveGame userData, error: ', e);
        save.userData = 'error';
    }
    util.log('log;', 'GameManager.saveGame, save: ', save.roomId, 'time: ', Date.now() - save.timeEnd);
    this.server.storage.pushGame(save);
};


GameManager.prototype.getUserRoom = function(user, notSpectator){
    notSpectator = notSpectator !== false; // true default
    if (!user.currentRoom) return null;
    if (!notSpectator) return user.currentRoom;
    if (user.currentRoom.players.indexOf(user) != -1) return user.currentRoom;
    else {
        util.log('log;', 'GameManager.getUserRoom', 'user spectate in', user.currentRoom.id, user.userId);
        return null;
    }
};


GameManager.prototype.getSpectatorRoom = function (user){
    if (!user.currentRoom) return null;
    if (user.currentRoom.spectators.indexOf(user) != -1) return user.currentRoom;
    else {
        util.log('err;', 'GameManager.getSpectatorRoom', 'user not spectate in', user.currentRoom.id, user.userId);
        return null;
    }
};



GameManager.prototype.sendError = function(user, error){
    this.server.router.send({
        module: 'game_manager',
        type: 'error',
        target:  user,
        data: error
    });
};


GameManager.prototype.generateRoomId = function(owner, type){
    //game format name: "game_type_userId_socketId_hh.mm.ss"
    var now = new Date();
    return this.server.game + "_" + type + "_" + owner.userId + "_" + owner.socket.id
        + "_" + now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds();
};