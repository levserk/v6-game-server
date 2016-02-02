var EventEmitter = require('events').EventEmitter;
var Router = require('./router.js');
var InviteManager = require('./invite_manager.js');
var RatingManager = require('./rating_manager.js');
var HistoryManager = require('./history_manager.js');
var GameManager = require('./game_manager.js');
var ChatManager = require('./chat_manager.js');
var User = require('./user.js');
var AdminManager = require('./admin_manager.js');
var defaultConf = require('./conf.js');
var defaultEngine = require('./engine.js');
var SocketServer = require('v6-ws').SocketServer;
var util = require('util');
var logger = require('./logger.js');

module.exports = function (opts, engine) {
    if (typeof opts != "object" || (typeof engine != "object" && typeof engine != "function"))
        throw new Error("Conf and engine are required");
    opts.game = opts.game || defaultConf.game;
    opts.path = opts.game;
    opts.modes = opts.modes || opts.gameModes || defaultConf.gameModes;
    opts.modesAlias = opts.modesAlias || defaultConf.modesAlias;
    opts.ratingElo = opts.ratingElo !== false;
    opts.calcDraw = opts.calcDraw || defaultConf.calcDraw;
    opts.loadRanksInRating = !!opts.loadRanksInRating;
    opts.closeOldConnection = opts.closeOldConnection !== false;
    opts.reconnectOldGame = opts.reconnectOldGame !== false;
    opts.spectateEnable = opts.spectateEnable !== false;
    opts.clearTimeouts = opts.clearTimeouts !== false;
    opts.loseOnLeave = opts.loseOnLeave || defaultConf.loseOnLeave;
    opts.turnTime = opts.turnTime || defaultConf.turnTime;
    opts.timeMode = opts.timeMode || defaultConf.timeMode;
    opts.timeStartMode = opts.timeStartMode || defaultConf.timeStartMode;
    opts.addTime = opts.addTime || defaultConf.addTime;
    opts.maxTimeouts = opts.maxTimeouts || defaultConf.maxTimeouts;
    opts.maxOfflineTimeouts = opts.maxOfflineTimeouts || opts.maxTimeouts;
    opts.minTurns = opts.minTurns || defaultConf.minTurns;
    opts.takeBacks = opts.takeBacks || defaultConf.takeBacks;
    opts.ratingUpdateInterval =  opts.ratingUpdateInterval || defaultConf.ratingUpdateInterval;
    opts.adminList =  opts.adminList || defaultConf.adminList;
    opts.adminPass =  opts.adminPass || defaultConf.adminPass;
    opts.db =  opts.db || defaultConf.db;
    opts.mongo =  opts.mongo || defaultConf.mongo;
    opts.redis =  opts.redis || defaultConf.redis;
    opts.enableIpGames = opts.enableIpGames || defaultConf.enableIpGames;
    opts.minUnfocusedTurns = opts.minUnfocusedTurns || defaultConf.minUnfocusedTurns;
    opts.minPerUnfocusedTurns = opts.minPerUnfocusedTurns || defaultConf.minPerUnfocusedTurns;

    if (Server.TIME_MODES.indexOf(opts.timeMode) == -1){
        opts.timeMode = defaultConf.timeMode;
    }
    if (Server.TIME_START_MODES.indexOf(opts.timeStartMode) == -1){
        opts.timeStartMode = defaultConf.timeStartMode;
    }
    logger.logLevel = opts.logLevel || 1;

    return new Server(opts, engine);
};

function Server(conf, engine){
    EventEmitter.call(this);
    this.version = "0.9.28";
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

Server.TIME_MODES = ['reset_every_turn', 'reset_every_switch', 'dont_reset', 'common'];
Server.TIME_START_MODES = ['after_turn', 'after_switch', 'after_round_start'];

util.inherits(Server, EventEmitter);

Server.prototype.init = function(){
    logger.log('GameServer.init', this.version, 'node: ', process.version, 0);

    var self = this;
    this.router = new Router(this);
    this.inviteManager = new InviteManager(this);
    this.ratingManager = new RatingManager(this);
    this.historyManager = new HistoryManager(this);
    this.gameManager = new GameManager(this);
    this.chatManager = new ChatManager(this);
    this.adminManager = new AdminManager(this);
    this.storage = this.isDevelop ? new (require('./develop/storage_interface.js'))(this) : new (require('./storage_interface.js'))(this);
    this.router.on('socket_disconnected', function(socket){
        logger.log('Server', 'on socket_disconnected', socket.id, 2);
        var user = self.getUserById(socket.id);
        // if closeOldConnection old socket closed
        if (!user){ // TODO: do not log error on user relogin
            if (!socket.reconnectUser)
                logger.warn('Server','on socket_disconnected', 'user not found! socket: ', socket.id, socket.userId, 2);
            return;
        }
        user.isConnected = false;
        self.onUserLeave(user);
    });

    this.router.on('socket_timeout', function(socket){
        logger.log('Server', 'on socket_timeout', socket.id, 2);
        var user = self.getUserById(socket.id);
        if (!user){
            logger.warn('Server', 'on socket_timeout', 'user not found! socket:', socket.id, socket.userId, 2);
            return;
        }
        user.isConnected = false;
        user.isTimeout = true;
        self.onUserLeave(user);
    });
};


Server.prototype.start = function(){
    logger.log('Server', 'GameServer started, listening port:', this.conf.port, 1);
    this.wss.init();
};


Server.prototype.onUserLogin = function(user){
    var self = this;
    // async get user data
    self.storage.getUserData(user)
        .then(function(data){
            if (user.socket.closed || !user.socket.ws){
                logger.warn('Server.onUserLogin socket closed', user.socket.id, user.socket.closed, !!user.socket.ws, 2);
                return;
            }
            user.applyData(data, self.modes);
            user.socket.enterRoom(self.game);
            self.sendUserLoginData(user);
            self.storage.pushUser(user);
            self.emit("user_login", user);
        })
        .catch(function(error){
            self.onLoginError(user, error);
        });
};


Server.prototype.onUserRelogin = function(newUser){
    var user = this.storage.getUser(newUser.userId);
    if (!user) {
        logger.err("Server.onUserRelogin", "user not exists in userlist", newUser.userId, 1);
        return;
    }
    logger.log("Server.onUserRelogin", newUser.userId, 'old socket ', user.socket.id, 'new socket', newUser.socket.id, 2);

    // TODO: send message to closed socket throw error
    // TODO: check user is connected, but socket room does't exists in socketServer room list
    var oldSocket = user.socket;
    user.socket = newUser.socket;
    if (user.isConnected) {
        try {
            this.router.send({
                module: 'server',
                type: 'error',
                target: oldSocket.id,
                data: 'new_connection'
            });
            oldSocket.reconnectUser = true;
            oldSocket.close();
        } catch (e){
            logger.err("Server.onUserRelogin", "error on closing old socket", newUser.userId, oldSocket.id, e, 1);
        }
    }
    user.socket.enterRoom(this.game);
    this.storage.popUser(user);
    this.sendUserLoginData(user);
    this.storage.pushUser(user);
    user.isConnected = true;
    this.emit("user_relogin", user);
};


Server.prototype.onLoginError = function(user, error){
    logger.err('Server.onLoginError', 'user login failed;', error, 1);
    if (user.socket.closed || !user.socket.ws){
        logger.warn('Server.onUserLogin socket closed', user.socket.id, user.socket.closed, !!user.socket.ws, 2);
        return;
    }
    this.router.send({
        module:'server',
        type:'error',
        target:user,
        data:'login_error'
    });
};


Server.prototype.sendUserLoginData = function(user){
    this.router.send({
        module:'server',
        type:'login',
        target:user,
        data:{
            you: user.getInfo(),
            userlist: this.getUserList(),
            rooms: this.storage.getRooms(),
            waiting: this.inviteManager.getWaitingUsers(),
            settings: user.settings,
            opts: {
                game: this.conf.game,
                modes: this.conf.modes,
                modesAlias: this.conf.modesAlias,
                turnTime: this.conf.turnTime,
                loadRanksInRating: this.conf.loadRanksInRating
            },
            ban: user.ban
        }
    });
};


Server.prototype.onUserLeave = function(user){
    var room = this.gameManager.getUserRoom(user, true);
    if (!room || !room.isPlaying()){
        this.storage.popUser(user);
    }
    this.emit("user_leave", user);
};


Server.prototype.onUserChanged = function(user, data){
    logger.log('Server.onUserChanged, userId:',user.userId, 3);
    var now = Date.now();
    if (data) {
        if (typeof data.isActive == 'boolean') user.isActive = data.isActive;
    }
    if (now - user.lastTimeSendInfo > 1000){ // send user info once a second
        this.sendUserInfo(user);
        user.lastTimeSendInfo = now;
    } else {
        logger.warn('Server.onUserChanged fast!', user.userId, 1)
    }
};

Server.prototype.sendUserInfo = function(user){
    this.router.send({
        module:"server",
        type: "user_changed",
        sender:user,
        target:this.game,
        data:user.getInfo()
    });
};


Server.prototype.getUserById = function(id){
    var userlist = this.storage.getUsers();
    for (var i = 0; i < userlist.length; i++){
        if (userlist[i].userId == id || userlist[i].socket.id == id){
            return userlist[i];
        }
    }
    logger.warn("Server.getUserById", "user not exists in userlist", id, 2);
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
    data.isAdmin = this.conf.adminList.indexOf(data.userId) != -1;
    data.options = null;
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
            modeData['timeLastGame'] = 0;
        }
        if (typeof this.engine.initUserData == "function")
            modeData = this.engine.initUserData(this.modes[i], modeData);
        data[this.modes[i]] = modeData;
    }
    return data;
};


Server.prototype.onMessage = function(message, type){
    switch (type) {
        case 'login':
            this.loginSocket(message);
            break;
        case 'settings': // player ready to play
            if (message.data)
                this.storage.saveUserSettings(message.sender, message.data);
            break;
        case 'changed':
            this.onUserChanged(message.sender, message.data);
            break;
    }
};


Server.prototype.loginSocket = function(message){
    logger.log('Server.loginSocket id:',  message.sender?message.sender.id:null, 'user:', message.data.userId, message.data.userName, 2);
    if (!message.sender || !message.sender.id){
        logger.err('Server.loginSocket', 'wrong socket', 1);
        return;
    }
    var user = new User(message.sender, message.data);
    if (!user.userId || !user.userName || !user.sign){
        this.onLoginError(user, 'wrong data');
        return;
    }

    var signIsRight = false;    // validate user data
    if (typeof this.engine.checkSign == "function") {
        signIsRight = this.engine.checkSign(user);
    } else {
        signIsRight = this.defaultEngine.checkSign(user);
    }
    if (!signIsRight){
        logger.err('Server.loginSocket', 'User sign is wrong', user.userId, user.userName, user.sign, 1);
        this.onLoginError(user, 'wrong sign');
        return;
    }

    user.isConnected = true;
    if (this.storage.getUser(user.userId) != null) {    //check user already connected
        logger.log('Server.loginSocket', "user is already connected", user.userId, 2);
        if (this.conf.closeOldConnection)
            this.onUserRelogin(user);
        else {
            // TODO: send socket message already connected
            user.socket.close();
        }
        return;
    }
    user.socket.userId = user.userId;
    this.onUserLogin(user);
};