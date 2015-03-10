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
                    winner: user
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
    },
    switchPlayer:function(room, user, turn){
        if (turn.switch){
            if (room.players[0] == user) return room.players[1];
            else return room.players[0];
        }
    },
    userEvent: function(room, user, event){
        return {
            event: event,
            target: room
        }
    }
};