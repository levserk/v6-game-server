var EventEmitter = require('events').EventEmitter;
var Router = require('./router.js');
var InviteManager = require('./invite_manager.js');
var GameManager = require('./game_manager.js');
var StorageInterface = require('./storage_interface.js');
var User = require('./user.js');
var SocketServer = require('v6-ws').SocketServer;
var util = require('util');

module.exports = function (opts, engine) {
    if (typeof opts != "object" || (typeof engine != "object" && typeof engine != "function"))
        throw new Error("Conf and engine are required");

    opts.game = opts.game || "default";
    opts.path = opts.game;
    opts.modes = opts.modes || opts.gameModes || ['default'];
    opts.closeOldConnection = opts.closeOldConnection || false;

    return new Server(opts, engine);
};

function Server(conf, engine){
    EventEmitter.call(this);
    this.conf = conf;
    this.engine = engine;
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
    this.gameManager = new GameManager(this);
    this.storage = new StorageInterface(this);

    this.router.on('socket_connection', function(socket){
        util.log("new socket_connection", socket.id, socket.cookie.userId);
        var user = new User(socket.cookie.userId, socket);
        user.isConnected = true;
        //check user already connected
        if (self.storage.getUser(user.userId) != null) {
            util.log("user is already connected", user.userId);
            if (self.conf.closeOldConnection) self.onUserRelogin(user); else user.socket.close();
            return;
        }
        self.onUserLogin(user);
    });

    this.router.on('socket_disconnected', function(socket){
        util.log("socket_disconnected", socket.id);
        var user = self.getUserById(socket.id);
        // if closeOldConnection old socket closed
        if (!user){ // TODO: do not log error on user relogin
            util.log('warn;', 'disconnected user not found! ',socket.id, socket.cookie.userId);
            return;
        }
        user.isConnected = false;
        self.onUserLeave(user);
    });

    this.router.on('socket_timeout', function(socket){
        util.log("socket_timeout", socket.id);
        var user = self.getUserById(socket.id);
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

            // send userlist to new user
            self.router.send({
                module:'server',
                type:'login',
                target:{user:user},
                data:{
                    you: user.getInfo(self.modes),
                    userlist: self.getUserList(),
                    rooms: self.storage.getRooms()
                }
            });

            self.storage.pushUser(user);
            self.emit("user_login", user);
        })
        .catch(function(error){
            util.log("error;", "user login error", error);
        },'');
};


Server.prototype.onUserRelogin = function(newUser){
    var user = this.storage.getUser(newUser.userId);
    if (!user) {
        util.log("error;","relogin", "user not exists in userlist", newUser.userId);
        return;
    }

    var oldSocket = user.socket;
    user.socket = newUser.socket;
    oldSocket.close();
    user.socket.enterRoom(this.game);
    this.storage.popUser(user);
    this.router.send({
        module:'server',
        type:'login',
        target:{user:user},
        data:{
            you: user.getInfo(this.modes),
            userlist: this.getUserList(),
            rooms: this.storage.getRooms()
        }
    });
    this.storage.pushUser(user);
    this.emit("user_relogin", user);
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
        userlistInfo.push(userlist[i].getInfo(this.modes));
    }
    return userlistInfo;
};
