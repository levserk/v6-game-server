var EventEmitter = require('events').EventEmitter;
var Promise = require('es6-promise').Promise;
var mysql = require('mysql');
var Mongo = require('./mongo.js');
var util = require('util');
var redis = require("redis");

module.exports = StorageInterface;

function StorageInterface(server){
    this.users = [];
    this.allUsers = [];
    this.rooms = {};
    this.roomsInfo = [];
    this.messages = [];
    this.lastMessages = [];
    this.games = [];
    this.history = [];
    this.LAST_MSG_COUNT = 10;
    this.server = server;
    this.mongo = new Mongo(server);
    if (this.server.conf.mode != 'debug') this.mysqlPool = mysql.createPool(server.conf.db);

    this.mongo.init();
    this.redis = redis.createClient();
    this.redis.on("error", function (err) {
        util.log("err;  Redis " + err);
    });

    var promises = [];
    for (var i = 0; i < server.modes.length; i++){
        promises.push(this.loadRanks(server.modes[i]));
    }
    Promise.all(promises)
        .then(function () {
            util.log('log;', 'StorageInterface load ranks complete');
        })
        .catch(function (err) {
            util.log('log;', 'StorageInterface laod ranks error', err);
        })
}


StorageInterface.prototype.getUserData = function(user){
    var self = this, test = this.server.conf.mode == 'debug';
    return new Promise(function(res, rej){
        self.mongo.getUserData(user.userId)
            .then(self.loadUserRating.bind(self))
            .then(function(userData){   // loading user data complete
                if (!test) {
                    var pool = self.mysqlPool;
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
                                userData['userName'] = userName;
                                res(userData);
                            }

                            else rej('user not reg! userId: '+user.userId + ' sessionId: ' + user.sessionId);
                        });
                    return;
                }
                userData.userName = "us_"+user.userId;
                if (!user.userId) rej('user not reg! userId: '+user.userId + ' sessionId: ' + user.sessionId);
                res(userData);
            })
            .catch(function(err){   // loading user data failed
                rej('can not load user data ' + userId);
            });
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


StorageInterface.prototype.saveUsers = function(users, mode, callback) {
    //TODO: refactor this
    var key = this.server.game + ':' + mode + ':' + 'ranks', self = this;

    for (var i = 0; i < users.length; i++) {
        var user = users[i];
        this.redis.zadd(key, user[mode].ratingElo, user.userId);
    }

    saveUser(self.redis, users[0].getInfo(), mode, function(){
        saveUser(self.redis, users[1].getInfo(), mode, callback);
    });

    function saveUser(redis, data, mode, _callback){
        self.redis.zrevrank(key, data.userId, function(err, result){
            if (err || result === null) {
                util.log('log;', 'StorageInterface.saveUser get rank failed ', err||result, data.userId);
            } else {
                data[mode].rank = result+1;
                util.log('log;', 'redis rank', data.userId, result+1);
            }
            self.mongo.saveUserData(data)
                .then(function () {
                    util.log('log;', 'StorageInterface.saveUser success ', data.userId, mode);
                })
                .catch(function () {
                    util.log('log;', 'StorageInterface.saveUser failed ', data.userId, mode);
                });
            _callback();
        });
    }
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
    this.mongo.saveMessage(message);
    if (message.target == this.server.game) this.lastMessages.unshift(message);
    if (this.lastMessages.length>this.LAST_MSG_COUNT) this.lastMessages.pop();
};

StorageInterface.prototype.getMessages = function(count, time, target, sender){
    var self = this;
    if (!sender && !time && self.lastMessages.length == count) {// public messages, load from cache
        return new Promise(function(res){
            res(self.lastMessages);
        });
    }
    else return self.mongo.loadMessages(count, time?time:Date.now(), target, sender);
};


//____________ History ___________
StorageInterface.prototype.pushGame = function(save){
    this.mongo.saveGame(save);
};


StorageInterface.prototype.getGame = function(userId, gameId){
    return this.mongo.loadGame(gameId);
};


StorageInterface.prototype.getHistory = function(userId, mode){
    return this.mongo.loadHistory(userId, mode, 10, 0);
};


//_____________ Ratings ____________
StorageInterface.prototype.loadRanks = function(mode) {
    var self = this, count = 2; var stTime= Date.now();
    var key = self.server.game + ':' + mode + ':' + 'ranks';
    self.redis.del(key);
    util.log('log;', 'StorageInterface.loadRanks', 'loadRanks', mode);
    // recursive loading ranks
    return loadOrFinish(self.mongo.loadRanks(mode, count, 0));

    function loadOrFinish(load){
        return load.then(function (obj) {
            util.log('log;', 'load complete', obj.items.length, mode);
            var item, items = obj.items;
            for (var i = 0; i < items.length; i++){
                item = items[i];
                self.redis.zadd(key, item[mode].ratingElo, item.userId);
                util.log('log;', 'StorageInterface.loadRanks', 'rating', item.userId, item[mode]['ratingElo']);
            }
            if (obj.items.length == count) {
                return loadOrFinish(self.mongo.loadRanks(mode, count, obj.skip + count));
            }
            util.log('log;', 'loadOrFinishRanks', 'complete', mode, obj.skip+obj.items.length, 'time', Date.now() - stTime);
            return new Promise(function (res, rej) {
                res({
                    mode:mode,
                    count:obj.skip + obj.items.length
                });
            });
        });
    }
};


StorageInterface.prototype.loadUserRating = function(userData){
    util.log('log;', 'redis loadUserRating', userData.userId);
    var self = this;
    var promises = [];
    userData = self.server.initUserData(userData);
    for (var i = 0; i < self.server.modes.length; i++){
        promises.push(loadUserRank(userData, self.server.modes[i]));
    }
    return new Promise(function (res, rej) {
        Promise.all(promises).then(function(){
            res(userData);
        }).catch(function (err) {
            util.log('log;', 'redis loadUserRating err', err);
            res(userData);
        });
    });
    function loadUserRank (userData, mode){
        util.log('log;', 'redis loadUserRank', mode, userData.userId);
        return new Promise(function (res, rej) {
            var key = self.server.game + ':' +  mode + ':' + 'ranks';
            self.redis.zrevrank(key, userData.userId, function(err, result) {
                if (err || result === null) {
                    util.log('log;', 'StorageInterface.loadUserRating get rank failed ', err || result, userData.userId);
                } else {
                    userData[mode].rank = result + 1;
                    util.log('log;', 'redis loadUserRank', mode, userData.userId, result + 1);
                }
                res(userData)
            });
        });
    }
};


StorageInterface.prototype.updateRatings = function(mode) {
    var promises = [];
    for (var i = 0; i < this.users.length; i++){
        promises.push(this.loadUserRating(this.users[i]));
    }
    return Promise.all(promises);
};


StorageInterface.prototype.getRatings = function(userId, params){
    return this.mongo.loadRating(userId, params.mode, 50, 0, params.column, params.order);
};