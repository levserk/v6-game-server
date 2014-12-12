module.exports = Room;

function Room(id, owner, players, type){
    this.id = id;
    this.owner = owner;
    this.players = players;
    this.type = type;

    //game data
    this.game = {
        state:"waiting"
    };

    // players data
    this.data = {};
    for (var i = 0; i < players.length; i++) {
        this.data[players[i].userId] = {
            ready: false
        };
    }
}


Room.prototype.getPlayersId = function(){
    var ids = [];
    for (var i = 0; i < this.players.length; i++) ids.push(this.players[i].userId);
    return ids;
};


Room.prototype.getInfo = function(){
    return {
        players : this.getPlayersId(),
        room: this.id,
        type: this.type
    }
};


Room.prototype.checkPlayersReady = function(){
    for (var i = 0; i < this.players.length; i++){
        if (this.data[this.players[i].userId].ready == false) return false;
    }
    return true;
};

/**
 * game states:
 * waiting - waiting users ready
 * playing - users play
 * end - game round end
 */
