var EventEmitter = require('events').EventEmitter;
var Promise = require('es6-promise').Promise;
var Mongo = require('./mongo.js');
var util = require('util');
var redis = require("redis");

module.exports = StorageInterface;

function StorageInterface(server, callback){
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


    this.redis = redis.createClient();
    this.redis.on("error", function (err) {
        util.log("err;  Redis " + err);
    });

    // init mongo and then load ranks
    this.mongo.init(function(){
        var promises = [];
        for (var i = 0; i < server.modes.length; i++){
            promises.push(this.loadRanks(server.modes[i]));
        }
        Promise.all(promises)
            .then(function () {
                util.log('log;', 'StorageInterface loading ranks complete');
                if (callback) callback();
            })
            .catch(function (err) {
                util.log('err;', 'StorageInterface loading ranks failed', err);
                process.exit(1);
            })
    }.bind(this));
}


StorageInterface.prototype.getUserData = function(user){
    util.log('StorageInterface.getUserData', user.userId);
    var self = this;
    return new Promise(function(res, rej){
        if (!user.userId || user.userId == 'undefined'){
            rej('can not login without user id! check cookies');
            return;
        }
        self.mongo.getUserData(user.userId)
            .then(self.loadUserRating.bind(self))
            .then(function(userData){
                self.mongo.getUserSettings(userData.userId)
                    .then(function (settings) {
                        userData.settings = settings;
                        self.mongo.loadBan(userData.userId)
                            .then(function (ban) {
                                userData.ban = ban;
                                res(userData);
                            })
                            .catch(function (err) {   // loading user ban failed
                                rej('can not load user ban ' + userId);
                            })
                    });
            })
            .catch(function(err){   // loading user data failed
                rej('can not load user data '+ err + ' userId: ' + user.userId);
            });
    });
};


StorageInterface.prototype.saveUserSettings = function(user, settings){
    user.settings = settings;
    this.mongo.saveUserSettings(user.userId, settings);
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

StorageInterface.prototype.banUser = function(userId, timeEnd, reason){
    this.mongo.saveBan({
        userId:userId,
        timeEnd:timeEnd,
        timeStart: Date.now(),
        reason: reason
    });
};

StorageInterface.prototype.deleteMessage = function(id){
    this.mongo.deleteMessage(id);
};

//____________ History ___________
StorageInterface.prototype.pushGame = function(save){
    this.mongo.saveGame(save);
};


StorageInterface.prototype.getGame = function(userId, gameId){
    return this.mongo.loadGame(gameId);
};


StorageInterface.prototype.getHistory = function(userId, mode, count, offset){
    count = +count;
    offset = +offset;
    if (!count || count < 0 || count > 1000) count = 50;
    if (!offset || offset < 0) offset = 0;
    return this.mongo.loadHistory(userId, mode, count, offset);
};


//_____________ Ratings ____________
StorageInterface.prototype.loadRanks = function(mode) {
    var self = this, count = 100; var stTime= Date.now();
    var key = self.server.game + ':' + mode + ':' + 'ranks';
    self.redis.del(key);
    util.log('log;', 'StorageInterface.loadRanks', 'start loading users ranks, mode:', mode);
    // recursive loading ranks
    return loadOrFinish(self.mongo.loadRanks(mode, count, 0));

    function loadOrFinish(load){
        return load.then(function (obj) {
            //util.log('log;', 'load complete', obj.items.length, mode);
            var item, items = obj.items;
            for (var i = 0; i < items.length; i++){
                item = items[i];
                self.redis.zadd(key, item[mode].ratingElo, item.userId);
                //util.log('log;', 'StorageInterface.loadRanks', 'rating', item.userId, item[mode]['ratingElo']);
            }
            if (obj.items.length == count) {
                return loadOrFinish(self.mongo.loadRanks(mode, count, obj.skip + count));
            }
            util.log('log;', 'StorageInterface.loadRanks', 'loading users ranks complete, mode:', mode, obj.skip+obj.items.length, 'ranks, time:', Date.now() - stTime);
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
    //util.log('log;', 'redis loadUserRating', userData.userId);
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
        //util.log('log;', 'redis loadUserRank', mode, userData.userId);
        return new Promise(function (res, rej) {
            var key = self.server.game + ':' +  mode + ':' + 'ranks';
            self.redis.zrevrank(key, userData.userId, function(err, result) {
                if (err || result === null) {
                    if (err) util.log('log;', 'StorageInterface.loadUserRating get rank failed ', err, userData.userId);
                } else {
                    userData[mode].rank = result + 1;
                    //util.log('log;', 'redis loadUserRank', mode, userData.userId, result + 1);
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
    var count = +params.count;
    var offset = +params.offset;
    if (!count || count < 0 || count > 1000) count = 50;
    if (!offset || offset < 0) offset = 0;
    return this.mongo.loadRating(userId, params.mode, count, offset, params.column, params.order);
};