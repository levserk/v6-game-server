var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectID;
var Promise = require('es6-promise').Promise;
var util = require('util');

module.exports = Mongo;

function Mongo(server){
    this.server = server;
    var conf = server.conf.mongo;
        conf.database = server.game;
    this.url = 'mongodb://' + conf.host + ':' + conf.port + '/' + conf.database;

}

Mongo.prototype.init = function(callback){
    var self = this;
    MongoClient.connect(this.url, function(err, db) {
        if (err) {
            util.log('err;', 'Mongo', self.url, err);
            throw new Error('mongo connect failed!');
        }
        util.log('log;', 'Mongo.init', "Success connected to mongo ", self.url);
        // create collections
        db.collection('users');
        db.collection('settings');
        db.collection('history');
        db.collection('games');
        db.collection('messages');
        db.collection('bans');
        var col = db.collection('test');
        var key = Date.now();
        col.insertOne({time: key},function(err, resultInsert){
            util.log('log;', 'Mongo.init test insert, error:', err );
            if (!resultInsert) {
                throw new Error('test insert failed!');
            }
            if (resultInsert.insertedCount == 1){
                col.findOne({time: key}, function(err2, resultFind){
                    db.close();
                    util.log('log;', 'Mongo.init test find, error:', err2, 'result: ', resultFind);
                    util.log('log;', 'Mongo.init test total, error: ', err2, 'result: ', resultFind?'complete':'failed');
                    if (callback) callback();
                });
            } else {
                db.close();
                if (callback) callback();
            }
        })
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
                col.findOne({userId: userId},{}, function (err, item){
                    db.close();
                    if (err){
                        util.log('err;', 'Mongo.getUserData', err);
                        rej(err);
                        return;
                    }
                    res(item||{userId:userId});
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
                col.updateOne({userId: userData.userId}, userData, {upsert:true, w: 1}, function (err, result){
                    db.close();
                    if (err){
                        util.log('err;', 'Mongo.saveUserData error', err);
                        rej(err);
                        return;
                    }
                    util.log('log;', 'Mongo.saveUserData user updated', userData.userId,
                        result.matchedCount,
                        result.modifiedCount,
                        result.upsertedId,
                        result.upsertedCount);
                    res(true);
                });
            })
            .catch(function(err){
                rej(err);
            });
    });
};


Mongo.prototype.getUserSettings = function (userId) {
    var self = this;
    return new Promise(function(res, rej){
        self.connect()
            .then(function (db){
                var col = db.collection('settings');
                col.findOne({userId: userId},{}, function (err, item){
                    db.close();
                    if (err){
                        util.log('err;', 'Mongo.getUserSettings', err);
                    }
                    res(item?item.settings:null);
                });
            })
            .catch(function(err){
                rej(err);
            });
    });
};


Mongo.prototype.saveUserSettings = function (userId, settings){
    var self = this;
    return new Promise(function(res, rej){
        self.connect()
            .then(function (db){
                var col = db.collection('settings');
                col.updateOne({userId: userId}, {userId: userId, settings: settings}, {upsert:true, w: 1}, function (err, result){
                    db.close();
                    if (err){
                        util.log('err;', 'Mongo.saveUserSettings error', err);
                        rej(err);
                        return;
                    }
                    util.log('log;', 'Mongo.saveUserSettings user updated', userId,
                        result.matchedCount,
                        result.modifiedCount,
                        result.upsertedId,
                        result.upsertedCount);
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
                col.insertOne(message, function(err, result){db.close();});
            })
            .catch(function(err){});
};


Mongo.prototype.deleteMessage = function (id) {
    var self = this;
    self.connect()
        .then(function (db){
            var col = db.collection('messages');
            col.deleteOne({time:id}, function(err, result){db.close();});
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


Mongo.prototype.saveBan = function (ban){
    var self = this;
    self.connect()
        .then(function (db){
            var col = db.collection('bans');
            col.insertOne(ban, function(err, result){db.close();});
        })
        .catch(function(err){});
};


Mongo.prototype.loadBan = function (userId){
    var self = this;
    return new Promise(function(res, rej){
        self.connect()
            .then(function (db){
                var col = db.collection('bans');
                col.findOne({ userId: userId, timeEnd:{'$gt': Date.now()} }, function(err, item){
                    db.close();
                    if (err){
                        util.log('err;', 'Mongo.loadBan', err, item);
                    }
                    res(item);
                });
            })
            .catch(function(err){});
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
                query[mode+'.games'] = {'$gt': 0};
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


Mongo.prototype.loadRating = function(userId, mode, count, skip, column, order){
    var self = this; skip = skip || 0;
    if (column != 'dateCreate') column = mode + '.' + column;
    order = order || 'desc';
    return new Promise(function(res, rej){
        self.connect()
            .then(function (db){
                var col = db.collection('users');
                var query = {};
                query[mode] = { '$exists': true };
                query[mode+'.games'] = { '$gt': 0 };
                col.find(query, {"sort": [[column, order]], skip: skip, limit:count}).toArray(function (err, allUsers){
                    if (err){
                        util.log('err;', 'Mongo.loadRating', err);
                        db.close();
                        rej(err);
                    } else {                            // load user rating row
                        query['userId'] = userId;
                        col.findOne(query, {}, function (err, infoUser){
                            db.close();
                            if (err || !infoUser){
                                util.log('err;', 'Mongo.loadRating user row', err, infoUser);
                            }
                            res({
                                allUsers: allUsers,
                                infoUser: infoUser,
                                skip: skip
                            });
                        });
                    }
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
            col.insertOne(save, function(err, result){
                if (err || result.insertedCount != 1){
                    db.close();
                    util.log('err;', 'Mongo.saveGame', err || result);
                    return;
                }
                util.log('log;', 'Mongo.saveGame game saved ',result.insertedId);
                var game = {
                    _id: result.insertedId,
                    timeStart: save.timeStart,
                    timeEnd: save.timeEnd,
                    players: save.players,
                    mode: save.mode,
                    winner: save.winner,
                    action: save.action,
                    userData: save.userData
                };
                col = db.collection('history');
                col.insertOne(game, function(err, result){
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
                col.findOne({_id: new ObjectId(gameId)}, {}, function (err, item){
                    db.close();
                    if (err || !item){
                        util.log('err;', 'Mongo.loadGame', err || item);
                        rej(err);
                        return;
                    }
                    res(item);
                });
            })
            .catch(function(err){
                rej(err);
            });
    });
};
