module.exports = {
    getGameResult: function(room, user, turn){
        switch (turn.result){
            case 0: // win second player, white
                    for (var i = 0; i < room.players.length; i++){
                        if (room.players[i] != room.game.first) {
                            return {
                                winner: room.players[i]
                            };
                        }
                    }
                break;
            case 1: // win first player, black
                return {
                    winner: room.game.first
                };
                break;
            case 2: // draw
                return {
                    winner: null
                };
                break;
            default: return false;
        }
        throw new Error('can not compute winner! room:' + room.id + ' result: ' + turn.result);
    }
};