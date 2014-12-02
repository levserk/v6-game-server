var EventEmitter = require('events').EventEmitter;
var Promise = require('es6-promise').Promise;
var util = require('util');

module.exports = StorageInterface;

function StorageInterface(){
    this.users = [];
    this.rooms = {};
}


StorageInterface.prototype.getUserData = function(user){
    return new Promise(function(res, rej){
        // async load user data
        res({userName:"us_"+user.userId});
    });
};


//____________ User ___________
StorageInterface.prototype.pushUser = function(user){
    this.users.push(user);
};


StorageInterface.prototype.popUser = function(user){
    var id = (user.userId ? user.userId : user);
    for (var i=0; i < this.users.length; i++){
        if (this.users[i].userId == id) {
            this.users.splice(i, 1);
            return true;
        }
    }
    util.log("error;","popUser", "user not exists in userlist", user.userId);
    return false;
};


StorageInterface.prototype.getUser = function(id){
    for (var i=0; i < this.users.length; i++){
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
};


StorageInterface.prototype.popRoom = function(room){
    var id = (room.userId ? room.userId : room);
    delete this.rooms[id];
};


StorageInterface.prototype.getRoom = function(id){
    return this.rooms[id];
};



