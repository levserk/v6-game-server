module.exports = {
    initUserData: function(mode, modeData){
        if (!modeData.score) modeData.score = 100;
        return modeData;
    },
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
    getUsersScores: function(room, result){
        for (var i = 0; i < room.players.length; i++){
            if (room.players[i] == result.winner)
                room.players[i][room.mode].score += 10;
            else room.players[i][room.mode].score -= 10;
        }
        return result;
    },
    switchPlayer:function(room, user, turn){
        if (turn.switch){
            if (room.players[0] == user) return room.players[1];
            else return room.players[0];
        }
        return user;
    },
    userEvent: function(room, user, event){
        return {
            event: event,
            target: room
        }
    },
    gameEvent: function(room, user, event, flagRoundStart){
        if (flagRoundStart){
            var data = [];
            for (var i = 0; i < room.players.length; i++) {
                data.push({
                    target: room.players[i],
                    event: {
                        type: 'startEvent',
                        data: room.players[i].userId
                    }
                });
            }
            return data;
        }
    },
    checkSign: function(user){
        return (user.sign === user.userId + user.userName);
    }
};