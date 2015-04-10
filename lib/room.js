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

    //game data
    this.game = {
        state:"waiting"
    };

    // players data
    this.data = {};
    for (var i = 0; i < players.length; i++) {
        this.data[players[i].userId] = {
            ready: false,
            timeouts:0,
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
        mode: this.mode,
        turnTime: this.turnTime
    };
};


Room.prototype.getGameData = function() {
    return {
        roomInfo:this.getInfo(),
        initData:this.game.initData,
        state: this.game.state,
        score: this.getScore(),
        history: this.game.state == 'waiting' ? '' : this.game.shistory, // TODO: clear history on round end, after saving game
        nextPlayer: this.game.current.userId,
        userTime: this.timeout ? Date.now() - this.game.turnTime : null,
        playerTurns: this.game.playerTurns,
        turnTime: this.turnTime,
        saveHistory: this.saveHistory,
        saveRating: this.saveRating
    };
};


Room.prototype.getScore = function (){
    var score = {
        games: this.games
    };
    for (var i = 0; i < this.players.length; i++)
        score[this.players[i].userId] = this.data[this.players[i].userId].win;
    return score;
};


Room.prototype.checkPlayersReady = function(){
    for (var i = 0; i < this.players.length; i++){
        if (this.data[this.players[i].userId].ready == false) return false;
    }
    return true;
};

Room.prototype.isPlaying = function(){
    return this.game.state == "playing" && this.game && this.game.turns > 0;
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