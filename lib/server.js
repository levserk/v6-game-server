var EventEmitter = require('events').EventEmitter;
var Router = require('./router.js');
var InviteManager = require('./invite_manager.js');
var GameManager = require('./game_manager.js');
var StorageInterface = require('./storage_interface.js');
var User = require('./user.js');
var SocketServer = require('v6-ws').SocketServer;
var util = require('util');

module.exports = Server;

function Server(conf, engine){
    if (typeof conf != "object" || (typeof engine != "object" && typeof engine != "function")) throw new Error("Conf and engine are required");

    EventEmitter.call(this);

    conf.game = conf.game || "default";
    conf.path = conf.game;

    this.engine = engine;
    this.game = conf.game;
    this.closeOldConnection = conf.closeOldConnection != false;
    this.wss = new SocketServer(conf);

    this.userlist = [];

    this.init();
}

util.inherits(Server, EventEmitter);

Server.prototype.init = function(){
    util.log('log;', 'GameServer init');

    var self = this;
    this.router = new Router(this);
    this.inviteManager = new InviteManager(this);
    this.gameManager = new GameManager(this);
    this.storage = new StorageInterface();

    this.router.on('socket_connection', function(socket){
        util.log("new socket_connection", socket.id, socket.cookie.userId);
        var user = new User(socket.cookie.userId, socket);
        user.isConnected = true;
        //check user already connected
        if (self.storage.getUser(user.userId != null)) {
            util.log("user already connected", user.userId);
            if (self.closeOldConnection) self.onUserRelogin(user); else user.socket.close();
            return;
        }
        self.onUserLogin(user);
    });

    this.router.on('socket_disconnected', function(socket){
        util.log("socket_disconnected", socket.id);
        var user = self.getUserById(socket.id);
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
            user.applyData(data);
            user.socket.enterRoom(self.game);

            // send userlist to new user
            self.router.send({
                module:'server',
                type:'login',
                target:{user:user},
                data:{
                    you: user.getInfo(),
                    userlist: self.getUserList(),
                    rooms: self.storage.getRooms()
                }
            });

            self.storage.pushUser(user);
            self.emit("user_login", user);
        })
        .catch(function(error){
            util.log("error;", "error!!", error);
        },'');
};


Server.prototype.onUserRelogin = function(newUser){
    var user = this.storage.getUser(newUser.userId);
    if (!user) {
        util.log("error;","relogin", "user not exists in userlist", newUser.userId);
        return;
    }
    user.socket = newUser.socket;
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
        userlistInfo.push(userlist[i].getInfo());
    }
    return userlistInfo;
};
