var EventEmitter = require('events').EventEmitter;
var Promise = require('es6-promise').Promise;
var mysql = require('mysql');
var util = require('util');

module.exports = StorageInterface;

function StorageInterface(server){
    this.users = [];
    this.rooms = {};
    this.roomsInfo = [];
    this.messages = [{"text":"1","time":1421415932234,"userId":"78927","userName":"us_78927","target":"test"},{"text":"2","time":1421415944225,"userId":"78927","userName":"us_78927","target":"test"},{"text":"3","time":1421415946777,"userId":"78927","userName":"admin","admin":true,"target":"test"},{"text":"4","time":1421415951417,"userId":"78927","userName":"us_78927","target":"test"},{"text":"5","time":1421415959505,"userId":"78927","userName":"us_78927","target":"test"},{"text":"6","time":1421415986777,"userId":"78927","userName":"us_78927","target":"test"}];
    this.lastMessages = [{"text":"1","time":1421415932234,"userId":"78927","userName":"us_78927","target":"test"},{"text":"2","time":1421415944225,"userId":"78927","userName":"us_78927","target":"test"},{"text":"3","time":1421415946777,"userId":"78927","userName":"admin","admin":true,"target":"test"},{"text":"4","time":1421415951417,"userId":"78927","userName":"us_78927","target":"test"},{"text":"5","time":1421415959505,"userId":"78927","userName":"us_78927","target":"test"}];
    this.LAST_MSG_COUNT = 10;
    this.mysqlPool = mysql.createPool(server.conf.db);
    this.server = server;
}


StorageInterface.prototype.getUserData = function(user){
    var self = this;
    var pool = this.mysqlPool, test = this.server.conf.mode == 'test';
    return new Promise(function(res, rej){
        var data = {};
        data[self.server.modes[0]] = {};
        data[self.server.modes[0]]['win'] = 0;
        data[self.server.modes[0]]['lose'] = 0;
        data[self.server.modes[0]]['draw'] = 0;
        data[self.server.modes[0]]['games'] = 0;
        data[self.server.modes[0]]['rank'] = 0;
        data[self.server.modes[0]]['ratingElo'] = 0;

        // async load user data
        if (!test) {
            pool.query('SELECT l.userId, u.username ' +
            ' FROM lg_logged AS l JOIN kosynka_users AS u using(userId)' +
            " WHERE l.userId = ? AND l.sessionId = ? ", [user.userId, user.sessionId],
            function(err, rows){
                if (err) {
                    rej(err);
                    return;
                }
                var userName;
                if (rows.length == 1) userName = rows[0].username;
                if (userName) {
                    data['userName'] = userName;
                    res(data);
                }

                else rej('user not reg! userId: '+user.userId + ' sessionId: ' + user.sessionId);
            });
            return;
        }
        data.userName = "us_"+user.userId;
        if (!user.userId) rej('user not reg! userId: '+user.userId + ' sessionId: ' + user.sessionId);
        res(data);
    });
};


//____________ User ___________
StorageInterface.prototype.pushUser = function(user){
    this.users.push(user);
};


StorageInterface.prototype.popUser = function(user){
    var id = (user.userId ? user.userId : user);
    for (var i = 0; i < this.users.length; i++){
        if (this.users[i].userId == id) {
            this.users.splice(i, 1);
            return true;
        }
    }
    util.log("error;","popUser", "user not exists in userlist", user.userId);
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
    util.log("error;","popRoom", "room not exists in roomsInfo id:", id, room);
};


StorageInterface.prototype.getRoom = function(id){
    return this.rooms[id];
};


StorageInterface.prototype.getRooms = function(){
    return this.roomsInfo;
};


//____________ Chat ___________
StorageInterface.prototype.pushMessage = function(message){
    this.messages.push(message);
    if (message.target == this.server.game) this.lastMessages.push(message);
    if (this.lastMessages.length>this.LAST_MSG_COUNT) this.lastMessages.shift();
};

StorageInterface.prototype.getMessages = function(count, time, target, sender){
    if (sender) return [];
    if (!time) { // public messages
        return this.lastMessages;
    }
    for (var i = this.messages.length-1; i >=0; i--){
        if (this.messages[i].time <= time){
            var st = i - count;
            if (st < 0) st = 0;
            return this.messages.slice(st, i);
        }
    }
    return [];
};