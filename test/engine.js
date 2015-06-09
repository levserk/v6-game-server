module.exports = {
    initUserData: function(mode, modeData){
        if (!modeData.score) modeData.score = 100;
        return modeData;
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
        if (turn.switch || turn == 'timeout'){
            if (room.players[0] == user) return room.players[1];
            else return room.players[0];
        }
        return user;
    },
    doTurn: function(room, user, turn){
        if (turn.action == 'timeout' && room.data[user.userId].timeouts < room.maxTimeouts) {
            return { my_turn: '1'}
        }
        return turn;
    },
    userEvent: function(room, user, event){
        event.user = user.userId;
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