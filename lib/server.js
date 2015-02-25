var EventEmitter = require('events').EventEmitter;
var Router = require('./router.js');
var InviteManager = require('./invite_manager.js');
var RatingManager = require('./rating_manager.js');
var HistoryManager = require('./history_manager.js');
var GameManager = require('./game_manager.js');
var ChatManager = require('./chat_manager.js');
var StorageInterface = require('./storage_interface.js');
var DevelopStorageInterface = require('./develop/storage_interface.js');
var User = require('./user.js');
var defaultConf = require('./conf.js');
var defaultEngine = require('./engine.js');
var SocketServer = require('v6-ws').SocketServer;
var util = require('util');

module.exports = function (opts, engine) {
    if (typeof opts != "object" || (typeof engine != "object" && typeof engine != "function"))
        throw new Error("Conf and engine are required");
    opts.game = opts.game || defaultConf.game;
    opts.path = opts.game;
    opts.modes = opts.modes || opts.gameModes || defaultConf.gameModes;
    opts.ratingElo = opts.ratingElo || defaultConf.ratingElo;
    opts.closeOldConnection = opts.closeOldConnection || defaultConf.closeOldConnection;
    opts.turnTime = opts.turnTime || defaultConf.turnTime;
    opts.maxTimeouts = opts.maxTimeouts || defaultConf.maxTimeouts;
    opts.minTurns = opts.minTurns || defaultConf.minTurns;
    opts.ratingUpdateInterval =  opts.ratingUpdateInterval || defaultConf.ratingUpdateInterval;

    return new Server(opts, engine);
};

function Server(conf, engine){
    EventEmitter.call(this);
    this.isDevelop = (conf.mode == 'test' || conf.mode == 'develop');
    this.conf = conf;
    this.engine = engine;
    this.defaultEngine = defaultEngine;
    this.game = conf.game;
    this.wss = new SocketServer(conf);
    this.userlist = [];
    this.modes = conf.modes;
    this.init();
}

util.inherits(Server, EventEmitter);

Server.prototype.init = function(){
    util.log('log;', 'GameServer init');

    var self = this;
    this.router = new Router(this);
    this.inviteManager = new InviteManager(this);
    this.ratingManager = new RatingManager(this);
    this.historyManager = new HistoryManager(this);
    this.gameManager = new GameManager(this);
    this.chatManager = new ChatManager(this);
    this.storage = this.isDevelop ? new DevelopStorageInterface(this) : new StorageInterface(this);

    this.router.on('socket_connection', function(socket){
        util.log("new socket_connection", socket.id, socket.cookie.userId);
        var user = new User(socket.cookie.userId, socket);
        user.isConnected = true;
        //check user already connected
        if (self.storage.getUser(user.userId) != null) {
            util.log("user is already connected", user.userId);
            if (self.conf.closeOldConnection)
                self.onUserRelogin(user);
            else user.socket.close();
            return;
        }
        self.onUserLogin(user);
    });

    this.router.on('socket_disconnected', function(socket){
        util.log("socket_disconnected", socket.id);
        var user = self.getUserById(socket.id);
        // if closeOldConnection old socket closed
        if (!user){ // TODO: do not log error on user relogin
            util.log('warn;', 'disconnected user not found! ', socket.id, socket.cookie.userId);
            return;
        }
        user.isConnected = false;
        self.onUserLeave(user);
    });

    this.router.on('socket_timeout', function(socket){
        util.log("socket_timeout", socket.id);
        var user = self.getUserById(socket.id);
        if (!user){
            util.log('warn;', 'disconnected timeout user not found! ', socket.id, socket.cookie.userId);
            return;
        }
        user.isConnected = false;
        user.isTimeout = true;
        self.onUserLeave(user);
    });
};


Server.prototype.start = function(){
    util.log('log;', 'GameServer start');
    this.wss.init();
};


Server.prototype.onUserLogin = function(user){
    var self = this;
    // async get user data
    self.storage.getUserData(user)
        .then(function(data){
            user.applyData(data, self.modes);
            user.socket.enterRoom(self.game);
            self.sendUserInfo(user);
            self.storage.pushUser(user);
            self.emit("user_login", user);
        })
        .catch(function(error){
            util.log("error;", "user login error", error);
            self.router.send({
                module:'server',
                type:'error',
                target:user,
                data:'login_error'
            });
        });
};


Server.prototype.onUserRelogin = function(newUser){
    var user = this.storage.getUser(newUser.userId);
    if (!user) {
        util.log("err;","Server.onUserRelogin", "user not exists in userlist", newUser.userId);
        return;
    }
    util.log("log;", "Server.onUserRelogin", newUser.userId);

    var oldSocket = user.socket;
    user.socket = newUser.socket;
    oldSocket.close();
    user.socket.enterRoom(this.game);
    this.storage.popUser(user);
    this.sendUserInfo(user);
    this.storage.pushUser(user);
    this.emit("user_relogin", user);
};


Server.prototype.sendUserInfo = function(user){
    this.router.send({
        module:'server',
        type:'login',
        target:user,
        data:{
            you: user.getInfo(),
            userlist: this.getUserList(),
            rooms: this.storage.getRooms(),
            opts: {
                game: this.conf.game,
                modes: this.conf.modes,
                turnTime: this.conf.turnTime
            }
        }
    });
};


Server.prototype.onUserLeave = function(user){
    this.storage.popUser(user);
    this.emit("user_leave", user);
};


Server.prototype.getUserById = function(id){
    var userlist = this.storage.getUsers();
    for (var i = 0; i < userlist.length; i++){
        if (userlist[i].userId == id || userlist[i].socket.id == id){
            return userlist[i];
        }
    }
    return null;
};


Server.prototype.getUserList = function(){
    var userlistInfo = [], userlist = this.storage.getUsers();
    for (var i = 0; i < userlist.length; i++){
        userlistInfo.push(userlist[i].getInfo());
    }
    return userlistInfo;
};


Server.prototype.initUserData = function(data){
    data = data || {};
    data.dateCreate = data.dateCreate || Date.now();
    var modeData, i;
    for (i = 0; i < this.modes.length; i++){
        modeData = data[this.modes[i]];
        if (!modeData) {
            modeData = {};
            modeData['win'] = 0;
            modeData['lose'] = 0;
            modeData['draw'] = 0;
            modeData['games'] = 0;
            modeData['rank'] = 0;
            modeData['ratingElo'] = 1600;
            data[this.modes[i]] = modeData;
        }
    }
    return data;
};