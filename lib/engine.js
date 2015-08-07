module.exports = {
    /**
     * init logged user mode data, set your default scores here
     * @param mode
     * @param modeData
     * @returns {*}
     */
    initUserData: function(mode, modeData){
        return modeData;
    },
    /**
     * on round begin init something
     * @param room
     * @returns {{inviteData: (*|userData.inviteData|Room.inviteData)}}
     */
    initGame: function (room) {
        return {
            inviteData: room.inviteData
        }
    },

    /**
     * on round begin set's first player
     * @param room
     * @returns {{player: Object}}
     */
    setFirst: function (room) {
        if (!room.game.first) return room.owner;
        return room.getOpponent(room.game.first);
    },

    /**
     * every turn do something and send this to all
     * @param room
     * @param user
     * @param turn
     * @param type {'turn'|'timeout'}
     * @returns {turn}
     */
    doTurn: function(room, user, turn, type){
        if (type == 'timeout'){
            // this is user timeout
        }
        return turn;
    },

    /**
     * every user turn checks switch player to next
     * @param room
     * @param user
     * @param turn
     * @param type {'turn'|'timeout'}
     * @returns {*}
     */
    switchPlayer: function(room, user, turn, type){
        if (type == 'timeout'){
            // this is user timeout
        }
        return room.getOpponent(user);
    },

    /**
     * every user event. Do what you need and send event in room or to user
     * @param room
     * @param user
     * @param event
     * @returns {{event: *, target: null|Room|User, user: null|userId} || Array}
     */
    userEvent: function(room, user, event){
        return {
            event: event,
            target: room,
            user: user.userId
        }
    },

    /**
     * every user turn and on round start. Do what you need and send event in room or to user
     * @param room
     * @param user
     * @param turn
     * @param roundStart flag, event on round start
     * @returns {{event: *, target: null|Room|User, user: null|userId} || Array}
     */
    gameEvent: function(room, user, turn, roundStart){
       return null;
    },

    /**
     * every user turn checks game result
     * @param room
     * @param user
     * @param turn
     * @param type {'turn'|'event'|'timeout'}
     * @returns {*} false - game not end, null - draw, {winner : user} - winner
     */
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
                if (turn.type){
                    return false;
                }
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

    /**
     * set players score player[room.mode]['your_score'], winner: result: winner
     * returns what you to send
     * @param room
     * @param result
     */
    getUsersScores: function(room, result){
        return result;
    },

    /**
     * check user sign is right
     * @param user
     * @returns {data.userId|*|.data.userId|ChatManager.message.userId|userId|query.$or.userId}
     */
    checkSign: function(user){
        return (user.userId && user.userName && user.sign);
    },

    /**
     * do something on admin message
     * @param admin
     * @param type
     * @param data
     */
    adminAction: function(admin, type, data){

    }
};