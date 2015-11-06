var logger = require('./logger.js');

module.exports = Room;

function Room(id, owner, players, data){
    this.id = id;
    this.owner = owner;
    this.players = players;
    this.spectators = [];
    this.inviteData = data;
    this.mode = data.mode;
    this.timeout = null;
    this.games = 0;
    this.saveHistory =  false;
    this.saveRating =  false;
    this.turnTime = 0;
    this.userTurnTime = null;
    this.createTime = Date.now();

    //game data
    this.game = {
        state:"waiting",
        current: owner
    };

    // players data
    this.data = {};
    for (var i = 0; i < players.length; i++) {
        this.data[players[i].userId] = {
            ready: false,
            timeouts:0,
            takeBacks:0,
            win:0
        };
    }
}

Room.prototype.name = '__Room__';


Room.prototype.getPlayersId = function(){
    var ids = [];
    for (var i = 0; i < this.players.length; i++) ids.push(this.players[i].userId);
    return ids;
};

Room.prototype.getSpectatorsId = function(){
    var ids = [];
    for (var i = 0; i < this.spectators.length; i++) ids.push(this.spectators[i].userId);
    return ids;
};


Room.prototype.getInfo = function(){
    return {
        room: this.id,
        owner: this.owner.userId,
        data: this.inviteData,
        players: this.getPlayersId(),
        spectators: this.getSpectatorsId(),
        mode: this.mode,
        turnTime: this.turnTime,
        takeBacks: this.takeBacks,
        timeMode: this.timeMode,
        timeStartMode: this.timeStartMode
    };
};


Room.prototype.getOpponent = function(user) {
    if (!user || !user.userId){
        throw new Error('wrong user to get opponent');
    }
    return this.players[0] == user ? this.players[1] : this.players[0];
};


Room.prototype.getGameData = function() {
    return {
        roomInfo:this.getInfo(),
        initData:this.game.initData,
        state: this.game.state,
        score: this.getScore(),
        history: this.game.state == 'waiting' ? '' : this.game.shistory, // TODO: clear history on round end, after saving game
        nextPlayer: this.game.current.userId,
        userTime: this.timeout ? Date.now() - this.game.turnStartTime : null,
        playerTurns: this.game.playerTurns,
        turnTime: this.turnTime,
        gameTime: this.createTime ? Date.now() - this.createTime : 0,
        roundTime: this.game.timeStart ? Date.now() - this.game.timeStart: 0,
        takeBacks: this.takeBacks,
        saveHistory: this.saveHistory,
        saveRating: this.saveRating,
        usersTakeBacks: this.getUsersTakeBacks(),
        userData: this.getUserData()
    };
};


Room.prototype.getUserData = function(){
    var data = {}, i, player, id;
    for (i = 0; i < this.players.length; i++){
        player = this.players[i];
        id = player.userId;
        if (!data[id]){
            data[id] = {
                userTotalTime: this.data[id].userTotalTime,
                userTurnTime: this.data[id].userTurnTime,
                takeBacks: this.data[id].takeBacks,
                win:  this.data[id].win
            }
        }
    }
    return data;
};


Room.prototype.getScore = function (){
    var score = {
        games: this.games
    };
    for (var i = 0; i < this.players.length; i++)
        score[this.players[i].userId] = this.data[this.players[i].userId].win;
    return score;
};


Room.prototype.getUsersTakeBacks = function(){
    var usersTakeBacks = {};
    for (var i = 0; i < this.players.length; i++)
        usersTakeBacks[this.players[i].userId] = this.data[this.players[i].userId].takeBacks;
    return usersTakeBacks;
};


Room.prototype.setUserTurnTime = function(time, user){
    if (user) {
        this.data[user.userId].userTurnTime = time;
    } else {
        for (var i = 0; i < this.players.length; i++){
            this.data[this.players[i].userId].userTurnTime = time;
        }
    }
};


Room.prototype.getTurnTime = function(user){
    if (!user) user = this.game.current;
    return this.data[user.userId].userTurnTime;
};


Room.prototype.getUserTime = function(){
    return Date.now() - (this.game.turnStartTime || this.game.timeStart);
};


Room.prototype.savePlayerTurn = function(turn, nextPlayer){
    turn.userTurnTime = this.getTurnTime(nextPlayer);
    turn.userTime = this.getUserTime();
    this.game.history.push(turn);
    try{
        if (this.game.shistory.length>0)  this.game.shistory += '@';
        this.game.shistory += JSON.stringify(turn);
    } catch (e){
        logger.err('Room.savePlayerTurn', 'json stringify error!', turn,  e, 1)
    }
};


Room.prototype.savePlayerEvent = function(target, event){
    if (target.name == '__User__')
        event.target = target.userId;
    else event.target = 'room';

    this.savePlayerTurn(event);
};


Room.prototype.checkPlayersReady = function(){
    for (var i = 0; i < this.players.length; i++){
        if (this.data[this.players[i].userId].ready == false) return false;
    }
    return true;
};

Room.prototype.isPlaying = function(){
    // game started if there is timeout
    return this.game.state == "playing" && this.game && this.timeout;
};


Room.prototype.hasOnlinePlayer = function(){
    for (var i = 0; i < this.players.length; i++)
        if (this.players[i].isConnected) return true;
    return false;
};

/**
 * game states:
 * waiting - waiting users ready
 * playing - users play
 * end - game round end
 */