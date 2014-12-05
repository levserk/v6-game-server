module.exports = Room;

function Room(id, owner, players, type){
    this.id = id;
    this.owner = owner;
    this.players = players;
    this.type = type;

    this.game = {
        state:"waiting"
    };
}


Room.prototype.getPlayersId = function(){
    var ids = [];
    for (var i = 0; i < this.players.length; i++) ids.push(this.players[i].userId);
    return ids;
};

/**
 * game states:
 * waiting - waiting users ready
 * playing - users play
 * end - game round end
 */
