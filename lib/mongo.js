var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectID;
var Promise = require('es6-promise').Promise;
var util = require('util');
var logger = require('./logger.js');

module.exports = Mongo;

function Mongo(server){
    this.server = server;
    var conf = server.conf.mongo;
        conf.database = server.game;
    this.url = 'mongodb://' + conf.host + ':' + conf.port + '/' + conf.database;
    this.collections = [
        {
            name: 'users',
            indexes:[
                {
                    name: 'userId',
                    fields: {userId: 1},
                    unique: true
                },
                {
                    name: 'games',
                    fields: {games: 1, ratingElo: 1},
                    mode: true
                },
                {
                    name: 'dateCreate',
                    fields: {dateCreate: -1, games: 1},
                    mode: true
                },
                {
                    name: 'ratingElo',
                    fields: {ratingElo: -1, games: 1},
                    mode: true
                },
                {
                    name: 'win',
                    fields: {win: -1, games: 1},
                    mode: true
                },
                {
                    name: 'timeLastGame',
                    fields: {timeLastGame: -1},
                    mode: true
                }
            ]
        },
        {
            name: 'settings',
            indexes:[
                {
                    name: 'userId',
                    fields: {userId: 1},
                    unique: true
                }
            ]
        },
        {
            name: 'history',
            indexes:[
                {
                    name: 'players',
                    fields: {players: 1, mode: 1, timeEnd: -1}
                }
            ]
        },
        { name: 'games', indexes:[] },
        {
            name: 'messages',
            indexes:[
                {
                    name: 'userId',
                    fields: {userId: 1, time: -1}
                },
                {
                    name: 'target',
                    fields: {target: 1, time: -1}
                },
                {
                    name: 'time',
                    fields: {time: -1}
                },
                {
                    name: 'target_userId',
                    fields: {target: 1, userId: 1, time: -1}
                }
            ]
        },
        {
            name: 'bans',
            indexes:[
                {
                    name: 'userId',
                    fields: {userId: 1, timeEnd: -1}
                }
            ]
        },
        {
            name: 'penalties',
            indexes:[
                {
                    name: 'userId',
                    fields: {userId: 1, mode: 1, time: -1}
                }
            ]
        }
    ]
}

Mongo.prototype.init = function(callback){
    var self = this;
    MongoClient.connect(this.url, function(err, db) {
        if (err) {
            logger.err('Mongo', self.url, err, 1);
            throw new Error('mongo connect failed!');
        }
        logger.log('Mongo.init', "Success connected to mongo ", self.url, 1);
        // create collections
        db.collection('users');
        db.collection('settings');
        db.collection('history');
        db.collection('games');
        db.collection('messages');
        db.collection('bans');
        var col = db.collection('test');
        var key = Date.now();
        col.insertOne({time: key}, function (err, resultInsert) {
            logger.log('Mongo.init test insert, error:', err, 1);
            if (!resultInsert) {
                throw new Error('test insert failed!');
            }
            if (resultInsert.insertedCount == 1) {
                col.findOne({time: key}, function (err2, resultFind) {
                    db.close();
                    logger.log('log;', 'Mongo.init test find, error:', err2, 'result: ', resultFind, 1);
                    logger.log('log;', 'Mongo.init test total, error: ', err2, 'result: ', resultFind ? 'complete' : 'failed', 1);
                    self.createIndexNotExists('test', 'time', {time: -1}).then(function(index) {
                        logger.log('log;', 'Mongo.init test index result: ', index == 'time' ? 'complete' : 'failed', 1);
                        if (callback) callback();
                    });
                });
            } else {
                db.close();
                if (callback) callback();
            }
        });
    });
};

Mongo.prototype.connect = function(){
    var self = this;
    return new Promise(function(res, rej){
        MongoClient.connect(self.url, function(err, db) {
            if (err) {
                logger.err('Mongo connect failed', err, 1);
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
                        logger.err('Mongo.getUserData', err, 1);
                        rej(err);
                        return;
                    }
                    item = item || {userId: userId};
                    res(item);
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
                        logger.err('Mongo.saveUserData error', err, 1);
                        rej(err);
                        return;
                    }
                    logger.log('Mongo.saveUserData user updated', userData.userId,
                        result.matchedCount,
                        result.modifiedCount,
                        result.upsertedId,
                        result.upsertedCount, 3);
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
                        logger.err('Mongo.getUserSettings', err, 1);
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
                        logger.err('Mongo.saveUserSettings error', err, 1);
                        rej(err);
                        return;
                    }
                    logger.log('log;', 'Mongo.saveUserSettings user updated', userId,
                        result.matchedCount,
                        result.modifiedCount,
                        result.upsertedId,
                        result.upsertedCount, 3);
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
    var self = this, timeStart = Date.now();
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
                    logger.log('Mongo.loadMessages query: db.messages.find(', query, ').sort({time: -1}) time: ', Date.now()-timeStart , 3);
                    db.close();
                    if (err){
                        logger.err('Mongo.loadMessages', err, 1);
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
                        logger.err('Mongo.loadBan', err, item, 1);
                    }
                    res(item);
                });
            })
            .catch(function(err){});
    });

};


Mongo.prototype.loadRanks = function (mode, count, skip, ratingElo) {
    var self = this, timeStart = Date.now();
    skip = skip || 0;
    ratingElo = ratingElo || 1600;
    return new Promise(function(res, rej){
        self.connect()
            .then(function (db){
                var col = db.collection('users');
                var query = {};
                query[mode+'.games'] = {'$gt': 0};
                query[mode+'.ratingElo'] = {'$gte': 0};
                col.find(query, {skip: skip, limit:count}).toArray(function (err, items){
                    logger.log('Mongo.loadRanks query: db.users.find(', query, ') time: ', Date.now()-timeStart, 3);
                    db.close();
                    if (err){
                        logger.err('Mongo.loadRanks', err, 1);
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


Mongo.prototype.loadRating = function(mode, count, skip, column, order, filter){
    var self = this, timeStart = Date.now();
    if (column != 'dateCreate') column = mode + '.' + column;
    order = order || 'desc';
    return new Promise(function(res, rej){
        self.connect()
            .then(function (db){
                var col = db.collection('users');
                var query = {};
                query[mode+'.games'] = { '$gt': 0 };
                if (filter) query['userName'] = {$regex: '^' + filter, $options: 'i'};
                col.find(query, {"sort": [[column, order]], skip: skip, limit:count}).toArray(function (err, allUsers){
                    db.close();
                    if (err){
                        logger.err('Mongo.loadRating', err, 1);
                        rej(err);
                    } else {
                        logger.log('Mongo.loadRating query: db.users.find(', query, ').sort({"', column,'" : 1}) time: ', Date.now()-timeStart, 3);
                        res(allUsers);
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
                    logger.err('Mongo.saveGame', err || result, 1);
                    return;
                }
                logger.log('Mongo.saveGame game saved ',result.insertedId, 3);
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
                    logger.log('Mongo.saveGame history saved', 3);
                });
            });
        })
        .catch(function(err){});
};


Mongo.prototype.loadHistory = function(userId, mode, count, offset, filter){
    var self = this, timeStart = Date.now();
    return new Promise(function(res, rej){
        self.connect()
            .then(function (db){
                var col = db.collection('history');
                var query = {players: {$in:[userId]}, mode: mode};
                if (filter) query['userData'] = {$regex: '"userName":"'+filter, $options: 'i'};
                col.find(query, { "sort": [['timeEnd', 'desc']], limit:count, skip: offset}).toArray(function (err, items){
                    db.close();
                    if (err){
                        logger.err('Mongo.loadHistory', err, 1);
                        rej(err);
                        return;
                    }
                    logger.log('Mongo.loadHistory query: db.history.find(', query, ').sort({timeEnd : -1}) time: ', Date.now()-timeStart, 3);
                    res(items);
                });
            })
            .catch(function(err){
                rej(err);
            });
    });
};
Mongo.prototype.loadPenalties = function(userId, mode, timeStart, timeEnd){
    var self = this, qtimeStart = Date.now();
    return new Promise(function(res, rej){
        if (!self.server.conf.penalties){
            res(null);
            return;
        }
        self.connect()
            .then(function (db){
                var col = db.collection('penalties');
                var query = {userId: userId, mode: mode};
                col.find(query, { "sort": [['time', 'desc']]}).toArray(function (err, items){
                    db.close();
                    if (err){
                        logger.err('Mongo.loadPenalties', err, 1);
                        rej(err);
                        return;
                    }
                    logger.log('Mongo.loadPenalties query: db.penalties.find(', query, ').sort({time : -1}) time: ', Date.now()-qtimeStart, 3);
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
                    if (err){
                        logger.err('Mongo.loadGame', err, 1);
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


Mongo.prototype.createIndexes = function(){
    var self = this;
        logger.log('Mongo.createIndexes', 'start', 2);
        var indexPromises = [];
        for (var i = 0; i < self.collections.length; i++){
            for (var j = 0; j < self.collections[i].indexes.length; j++){
                var index = self.collections[i].indexes[j];
                var collection = self.collections[i].name;
                if (index.mode){    // generate fields for each game mode
                    for (var n = 0; n < self.server.modes.length; n++){
                        var fields = {}, mode = self.server.modes[n];
                        for (var field in index.fields){
                            var name = field == 'dateCreate'?field:mode+'.'+field;
                            fields[name] = index.fields[field];
                        }
                        logger.log('Mongo.createIndexes', collection, mode+'_'+index.name, 'fields:', fields, 'unique:', !!index.unique, 3);
                        indexPromises.push(self.createIndexNotExists(collection, mode+'_'+index.name, fields, !!index.unique));
                    }
                } else {
                    logger.log('Mongo.createIndexes', collection, index.name, 'fields:', index.fields, 'unique:', !!index.unique, 3);
                    indexPromises.push(self.createIndexNotExists(collection, index.name, index.fields, !!index.unique));
                }
            }
        }
    return Promise.all(indexPromises);
};


Mongo.prototype.createIndexNotExists = function (collection, name, fields, unique) {
    var self = this; unique = !!unique;
    return new Promise(function(res, rej){
        self.connect()
            .then(function (db){
                var col = db.collection(collection);
                col.indexExists(name, function (err, result){
                    if (err){
                        logger.err('Mongo.createIndexNotExists', collection, err, 2);
                        db.close();
                        res(null);
                        return;
                    }
                    if (result){
                        logger.log('Mongo.createIndexNotExists', name, 'exists', 3);
                        db.close();
                        res(name);
                    } else {
                        logger.log('Mongo.createIndexNotExists', 'creating index', name, 3);
                        col.createIndex(fields, {name: name, w: 1, unique: unique, dropDups: unique, background: true}, function(err, index){
                            db.close();
                            if (err){
                                logger.err('Mongo.createIndexNotExists', err, 1);
                            }
                            logger.log('log;', 'Mongo.createIndexNotExists', 'creating index', index, index?'complete':'failed', 3);
                            res(index);
                        });
                    }
                });
            })
            .catch(function(err){
                rej(err);
            });
    });
};