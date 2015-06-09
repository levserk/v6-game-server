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
        if (room.players[0] == room.game.first)
            return room.players[1];
        else
            return room.players[0];
    },

    /**
     * every turn do something and send this to all
     * @param room
     * @param user
     * @param turn
     * @returns {turn}
     */
    doTurn: function(room, user, turn){
        return turn;
    },

    /**
     * every user time out, do something and return to send and save
     * @param room
     * @param user
     * @returns {Object}
     */
    onTimeout: function(room, user){
        return {action: 'timeout'};
    },

    /**
     * every user turn checks switch player to next
     * @param room
     * @param user
     * @param turn
     * @returns {*}
     */
    switchPlayer: function(room, user, turn){
        if (turn == 'timeout'){
            // this is user timeout
        }
        if (room.players[0] == user) return room.players[1];
        else return room.players[0];
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
     * @returns {*} false - game not end, null - draw, {winner : user} - winner
     */
    getGameResult: function(room, user, turn){
        // timeout
        if (turn == 'timeout'){
            // if user have max timeouts, other win
            if (room.data[user.userId].timeouts == room.maxTimeouts){
                return {
                    winner: room.players[0] == user ? room.players[1] : room.players[0]
                };
            } else return false;
        }

        // turn
        switch (turn.result){
            case 0: // win other player
                return {
                    winner: room.players[0] == user ? room.players[1] : room.players[2]
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
    }
};