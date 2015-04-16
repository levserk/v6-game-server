var Promise = require('es6-promise').Promise;
var util = require('util');
var logger = require('../logger.js');

module.exports = StorageInterface;

function StorageInterface(server){
    this.users = [];
    this.allUsers = [];
    this.bans = [];
    this.rooms = {};
    this.roomsInfo = [];
    this.messages = [];
    this.lastMessages = [];
    this.games = [];
    this.history = [];
    this.LAST_MSG_COUNT = 10;
    this.server = server;
}


StorageInterface.prototype.getUserData = function(user){
    logger.log('Develop/StorageInterface.getUserData', user.userId, 3);
    var self = this;
    return new Promise(function(res, rej){
        var data;
        for (var i = 0; i < self.allUsers.length; i++) {
            if (self.allUsers[i].userId == user.userId){
                data = self.allUsers[i];
                break;
            }
        }
        data = self.server.initUserData(data);
        data.ban = self.checkIsBanned(user.userId);
        data.isBanned = data.ban != false;
        data.settings = {};
        if (!user.userId || user.userId == 'undefined') rej('user not reg! userId: '+user.userId + ' sessionId: ' + user.sessionId);
        res(data);
    });
};

StorageInterface.prototype.saveUserSettings = function(user, settings){
    user.settings = settings;
};


//____________ User ___________
StorageInterface.prototype.pushUser = function(user){
    this.users.push(user);
    user.isRemoved = false;
};


StorageInterface.prototype.popUser = function(user){
    var id = (user.userId ? user.userId : user);
    for (var i = 0; i < this.users.length; i++){
        if (this.users[i].userId == id) {
            this.users[i].isRemoved = true;
            this.users.splice(i, 1);
            return true;
        }
    }
    logger.err('StorageInterface', "popUser", "user not exists in userlist", user.userId, 1);
    return false;
};


StorageInterface.prototype.getUser = function(id){
    for (var i = 0; i < this.users.length; i++){
        if (this.users[i].userId == id) {
            return this.users[i];
        }
    }
    return null;
};


StorageInterface.prototype.getUsers = function(){
    return this.users;
};


StorageInterface.prototype.saveUsers = function(users, mode, callback) {
    logger.log('StorageInterface.saveUsers', mode, 3);
    // check for duplicate
    var user;
    for (var j = 0; j < users.length; j++){
        user = users[j];
        var update = false;
        for (var i = 0; i < this.allUsers.length; i++) {
            if (this.allUsers[i].userId == user.userId){
                logger.log('StorageInterface.saveUser', 'update ', user.userId, 3);
                this.allUsers[i] = user.getInfo();
                update = true;
            }
        }
        if (!update) this.allUsers.push(user.getInfo());
    }
    if (callback) setTimeout(callback, 100);
};


//____________ Room ___________
StorageInterface.prototype.pushRoom = function(room){
    this.rooms[room.id] = room;
    this.roomsInfo.push(room.getInfo());
};


StorageInterface.prototype.popRoom = function(room){
    var id = (room.id ? room.id : room);
    delete this.rooms[id];
    for (var i = 0; i < this.roomsInfo.length; i++){
        if (this.roomsInfo[i].room == id) {
            this.roomsInfo.splice(i, 1);
            return true;
        }
    }
    logger.err('StorageInterface.popRoom', "room not exists in roomsInfo id:", id, room, 1);
};


StorageInterface.prototype.getRoom = function(id){
    return this.rooms[id];
};


StorageInterface.prototype.getRooms = function(){
    return this.roomsInfo;
};


//____________ Chat ___________
StorageInterface.prototype.pushMessage = function(message){
    this.messages.unshift(message);
    if (message.target == this.server.game) this.lastMessages.unshift(message);
    if (this.lastMessages.length>this.LAST_MSG_COUNT) this.lastMessages.pop();
};

StorageInterface.prototype.getMessages = function(count, time, target, sender){
    var self = this;
    return new Promise(function(res){
        if (sender) {
            res([]);
            return;
        }
        if (!time) { // public messages
            res(self.lastMessages);
            return;
        }
        for (var i = 0; i < self.messages.length; i++){
            if (self.messages[i].time < time){
                res(self.messages.slice(i, i+count));
                return;
            }
        }
        res([]);
    });
};

StorageInterface.prototype.banUser = function(userId, timeEnd, reason){
    this.bans.push({
        userId:userId,
        timeEnd:timeEnd,
        timeStart: Date.now(),
        reason: reason
    });
};



StorageInterface.prototype.deleteMessage = function(id){

};


StorageInterface.prototype.checkIsBanned = function (userId) {
    for (var i = 0; i < this.bans.length; i++) {
        logger.log('StorageInterface.checkIsBanned, user is banned', userId, 3);
        if (this.bans[i].userId == userId && this.bans[i].timeEnd > Date.now()) {
            return this.bans[i];
        }
    }

    return false;
};


//____________ History ___________
StorageInterface.prototype.pushGame = function(save){
    this.games.push(save);
    var game = {
        timeStart: save.timeStart,
        timeEnd: save.timeEnd,
        players: save.players,
        mode: save.mode,
        winner: save.winner,
        action: save.action,
        userData: save.userData
    };
    this.history.push(game);
};


StorageInterface.prototype.getGame = function(user, id){
    return new Promise(function(res) {
        for (var i = 0; i < this.games.length; i++) {
            if (this.games[i].timeEnd == id) {
                res(this.games[i]);
                return;
            }
        }
    }.bind(this));
};


StorageInterface.prototype.getHistory = function(userId, mode){
    return new Promise(function(res) {
        var history = [];
        for (var i = this.history.length - 1; i >= 0; i--) {
            if (this.history[i].mode == mode && this.history[i].players.indexOf(userId) > -1){
                this.history[i]._id = this.history[i].timeEnd;
                history.push(this.history[i]);
            }
        }
        res(history);
    }.bind(this));
};


//_____________ Ratings ____________
StorageInterface.prototype.updateRatings = function(mode) {
    var users = [], i, user, self = this;
    return new Promise(function (res, rej) {
        for (i = 0; i < self.allUsers.length; i++)
            if (self.allUsers[i][mode]['games'] > 0)
                users.push(self.allUsers[i]);
        users.sort(function (a, b) {
            return b[mode]['ratingElo'] - a[mode]['ratingElo'];
        });
        for (i = 0; i < users.length; i++) {
            users[i][mode]['rank'] = i + 1;
            user = self.getUser(users[i].userId);
            if (user) {
                logger.log('StorageInterface.updateRatings', user[mode]['rank'], i + 1 , 3);
                user[mode]['rank'] = i + 1;
            }
        }
        res(users);
    });

};


StorageInterface.prototype.getRatings = function(userId, params){
    return new Promise(function (res, rej) {
        var allUsers = [], infoUser, mode = params.mode;
        for (var i = 0; i < this.allUsers.length; i++) {
            if (this.allUsers[i][mode]['rank'] > 0)
                allUsers.push(this.allUsers[i]);
            if (this.allUsers[i].userId == userId) infoUser = this.allUsers[i];
        }
        allUsers.sort(function (a, b) {
            return b[mode]['ratingElo'] - a[mode]['ratingElo'];
        });
        res({
            allUsers: allUsers,
            infoUser: infoUser
        });
    }.bind(this));
};