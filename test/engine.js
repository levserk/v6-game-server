module.exports = {
    initUserData: function(mode, modeData){
        if (!modeData.score) modeData.score = 100;
        return modeData;
    },
    initGame: function (room) {
        return {
            inviteData: room.inviteData
        }
    },
    getUsersScores: function(room, result){
        for (var i = 0; i < room.players.length; i++){
            if (room.players[i] == result.winner)
                room.players[i][room.mode].score += 10;
            else room.players[i][room.mode].score -= 10;
        }
        return result;
    },
    switchPlayer:function(room, user, turn, type){
        if (type=='timeout'){
            console.log('switchPlayer', 'timeout', turn)
        }
        if (turn.switch || type == 'timeout'){
            return room.getOpponent(user);
        }
        return user;
    },
    doTurn: function(room, user, turn, type){
        if (type=='timeout'){
            console.log('doTurn', 'timeout', turn)
        }
        if (type == 'timeout' && room.data[user.userId].timeouts < room.maxTimeouts) {
            return { my_turn: 'auto_turn'}
        }
        if (turn.time){
            room.setUserTurnTime(turn.time);
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
    getGameResult: function(room, user, turn, type){
        switch (type){
            case 'timeout':
                if (type == 'timeout'){
                    // if user have max timeouts, other win
                    if (room.data[user.userId].timeouts == room.maxTimeouts){
                        return {
                            winner: room.getOpponent(user),
                            action: 'timeout'
                        };
                    } else return false;
                }
                break;
            case 'event':
                if (turn.type == 'win'){
                    return {
                        winner: user
                    };
                } else return false;
                break;
            case 'turn':
                switch (turn.result){
                    case 0: // win other player
                        return {
                            winner: room.getOpponent(user)
                        };
                        break;
                    case 1: // win current player
                        return {
                            winner: user
                        };
                        break;
                    case 2: // draw
                        return {
                            winner: null
                        };
                        break;
                    default: // game isn't end
                        return false;
                }
                break;
        }
    },
    checkSign: function(user){
        return (user.sign === user.userId + user.userName);
    },
    adminAction: function(admin, type, data){
        console.log(type);
    }
};