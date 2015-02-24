var MongoClient = require('mongodb').MongoClient;
var Promise = require('es6-promise').Promise;
var util = require('util');

module.exports = Mongo;

function Mongo(server){
    this.server = server;
    this.url = 'mongodb://localhost/'+server.game;

}

Mongo.prototype.init = function(){
    MongoClient.connect(this.url, function(err, db) {
        if (err) {
            util.log('err;', 'Mongo', err);
            throw new Error('mongo connect failed!');
        }
        util.log('log;', 'Mongo', "Success connected to mongo");
        // create collections
        db.collection('users');
        db.collection('history');
        db.collection('games');
        db.collection('messages');
        db.close();
    });
};

Mongo.prototype.connect = function(){
    var self = this;
    return new Promise(function(res, rej){
        MongoClient.connect(self.url, function(err, db) {
            if (err) {
                util.log('err;', 'Mongo connect failed', err);
                rej(err);
                return;
            }
            res(db);
        });
    });
};


Mongo.prototype.getUserData = function (userId) {
    var self = this;
    return new Promise(function(res, rej){
        self.connect()
            .then(function (db){
                var col = db.collection('users');
                col.find({userId: userId}).toArray(function (err, items){
                    db.close();
                    if (err){
                        util.log('err;', 'Mongo.getUserData', err);
                        rej(err);
                        return;
                    }
                    if (items.length == 1){
                        res(items[0]);
                    }
                    else {
                        util.log('log;', 'Mongo.getUserData', 'no user data in db', items.length, userId);
                        res({userId: userId});
                    }
                });
            })
            .catch(function(err){
                rej(err);
            });
    });
};


Mongo.prototype.saveUserData = function (userData){
    var self = this;
    return new Promise(function(res, rej){
        self.connect()
            .then(function (db){
                var col = db.collection('users');
                col.update({userId: userData.userId}, userData, {upsert:true, w: 1}, function (err, result){
                    db.close();
                    if (err){
                        util.log('err; ', 'Mongo.saveUserData error', err);
                        rej(err);
                        return;
                    }
                    util.log('log; ', 'Mongo.saveUserData user updated', userData.userId, result);
                    res(true);
                });
            })
            .catch(function(err){
                rej(err);
            });
    });
};


Mongo.prototype.saveMessage = function (message) {
    var self = this;
        self.connect()
            .then(function (db){
                var col = db.collection('messages');
                col.insert(message, function(err, result){db.close();});
            })
            .catch(function(err){});
};


Mongo.prototype.loadMessages = function (count, time, target, sender){
    var self = this;
    return new Promise(function(res, rej){
        self.connect()
            .then(function (db){
                var col = db.collection('messages');
                var query = {
                    time:{$lt:time}
                };
                if (!sender) // public
                    query.target = target;
                else        // private
                    query.$or = [{target: target, userId:sender}, {target:sender, userId:target}];
                col.find(query, { "sort": [['time','desc']], limit:count}).toArray(function (err, items){
                    db.close();
                    if (err){
                        util.log('err;', 'Mongo.loadMessages', err);
                        rej(err);
                        return;
                    }
                    res(items);
                });
            })
            .catch(function(err){
                rej(err);
            });
    });
};


Mongo.prototype.loadRanks = function (mode, count, skip) {
    var self = this; skip = skip || 0;
    return new Promise(function(res, rej){
        self.connect()
            .then(function (db){
                var col = db.collection('users');
                var query = {};
                query[mode] = { '$exists': true };
                col.find(query, {skip: skip, limit:count}).toArray(function (err, items){
                    db.close();
                    if (err){
                        util.log('err;', 'Mongo.loadRanks', err);
                        rej(err);
                        return;
                    }
                    res({
                        items: items,
                        skip: skip
                    });
                });
            })
            .catch(function(err){
                rej(err);
            });
    });
};


Mongo.prototype.loadRating = function(userId, mode, count, skip){
    var self = this; skip = skip || 0;
    return new Promise(function(res, rej){
        self.connect()
            .then(function (db){
                var col = db.collection('users');
                var query = {};
                query[mode] = { '$exists': true };
                col.find(query, {"sort": [[mode, 'desc']], skip: skip, limit:count}).toArray(function (err, items){
                    db.close();
                    if (err){
                        util.log('err;', 'Mongo.loadRating', err);
                        rej(err);
                        return;
                    }
                    res({
                        allUsers: items,
                        infoUser: null,
                        skip: skip
                    });
                });
            })
            .catch(function(err){
                rej(err);
            });
    });
};


Mongo.prototype.saveGame = function(save){
    var self = this;
    self.connect()
        .then(function(db){
            var col = db.collection('games');
            col.insert(save, function(err, result){
                if (err || result.length != 1){
                    db.close();
                    util.log('err;', 'Mongo.saveGame', err || result);
                    return;
                }
                util.log('log;', 'Mongo.saveGame game saved');
                var game = {
                    _id: result[0]._id,
                    timeStart: save.timeStart,
                    timeEnd: save.timeEnd,
                    players: save.players,
                    mode: save.mode,
                    winner: save.winner,
                    action: save.action,
                    userData: save.userData
                };
                col = db.collection('history');
                col.insert(game, function(err, result){
                    db.close();
                    util.log('log;', 'Mongo.saveGame history saved');
                });
            });
        })
        .catch(function(err){});
};


Mongo.prototype.loadHistory = function(userId, mode, count, offset){
    var self = this;
    return new Promise(function(res, rej){
        self.connect()
            .then(function (db){
                var col = db.collection('history');
                col.find({players: {$in:[userId]}, mode: mode}, { "sort": [['timeEnd', 'desc']], limit:count, offset: offset}).toArray(function (err, items){
                    db.close();
                    if (err){
                        util.log('err;', 'Mongo.loadHistory', err);
                        rej(err);
                        return;
                    }
                    res(items);
                });
            })
            .catch(function(err){
                rej(err);
            });
    });
};


Mongo.prototype.loadGame = function(gameId){
    var self = this;
    return new Promise(function(res, rej){
        self.connect()
            .then(function (db){
                var col = db.collection('games');
                col.find({_id: gameId}).toArray(function (err, items){
                    db.close();
                    if (err || items.length != 1){
                        util.log('err;', 'Mongo.loadGame', err || items.length);
                        rej(err);
                        return;
                    }
                    res(items[0]);
                });
            })
            .catch(function(err){
                rej(err);
            });
    });
};
