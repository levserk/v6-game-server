var util = require('util');
var math = require('math');
module.exports = RatingManager;

function RatingManager(server){

    var self = this;
    this.server = server;

}


RatingManager.prototype.onMessage = function(message, type){
    switch (type) {
        case 'ratings': // load history
            var ratings = this.getRatings(message.sender, message.data);
            this.server.router.send({
                    module: 'rating_manager',
                    type: 'ratings',
                    target: message.sender,
                    data: {
                        mode: message.data.mode,
                        ratings: ratings
                    }
                }
            );
            break;
    }
};


RatingManager.prototype.computeNewRatings = function (room, result){
    var mode = room.mode, winner, loser;
    if (result.winner == room.players[0].userId){
        winner = room.players[0];
        loser = room.players[1];
    } else {
        winner = room.players[1];
        loser = room.players[0];
    }
    winner[mode]['games']++;
    loser[mode]['games']++;

    if (!result.winner) {
        winner[mode]['draw']++;
        loser[mode]['draw']++;
        return;
    }
    winner[mode]['win']++;
    loser[mode]['lose']++;
    if (this.server.conf.ratingElo) this.computeNewElo(mode, winner, loser);
    this.server.storage.saveUser(winner);
    this.server.storage.saveUser(loser);
    this.updateRatings(mode);
};


RatingManager.prototype.computeNewElo = function (mode, winner, loser){

    winner[mode]['ratingElo'] = RatingManager.eloCalculation(winner[mode]['ratingElo'], loser[mode]['ratingElo'], 1, winner[mode]['games']<30);
    loser[mode]['ratingElo'] = RatingManager.eloCalculation(loser[mode]['ratingElo'], winner[mode]['ratingElo'], 0, loser[mode]['games']<30);

};

RatingManager.eloCalculation = function(player1Elo, player2Elo, sFaktor, isNovice) {
    var kFactor = 15;
    if(player1Elo >= 2400) kFactor = 10;
    else if(isNovice) kFactor = 30;
    var expectedScoreWinner = 1 / ( 1 + math.pow(10, (player2Elo - player1Elo)/400) );
    var e = kFactor * (sFaktor - expectedScoreWinner);
    return player1Elo + ~~e; //round e
};


RatingManager.prototype.updateRatings = function(mode) {
    var users = [], i, user;
    for (i = 0; i < this.server.storage.allUsers.length; i++)
        if (this.server.storage.allUsers[i][mode]['games']>0)
            users.push(this.server.storage.allUsers[i]);
    users.sort(function(a, b){
        return b[mode]['ratingElo'] - a[mode]['ratingElo'];
    });
    for (i = 0; i < users.length; i++){
        users[i][mode]['rank'] = i+1;
        user = this.server.storage.getUser(users[i].userId);
        if (user) {
            util.log('log;', 'RatingManager.updateRatings', user[mode]['rank'], i+1);
            user[mode]['rank'] = i+1;
        }
    }
};


RatingManager.prototype.getRatings = function(user, params){
    var allUsers = [], infoUser, mode = params.mode, users = this.server.storage.allUsers;
    //TODO: check mode isn't wrong
    for (var i = 0; i < this.server.storage.allUsers.length; i++) {
        if (this.server.storage.allUsers[i][mode]['rank'] > 0)
            allUsers.push(this.server.storage.allUsers[i]);
        if (this.server.storage.allUsers[i].userId == user.userId) infoUser = this.server.storage.allUsers[i];
    }
    allUsers.sort(function(a, b){
        return b[mode]['ratingElo'] - a[mode]['ratingElo'];
    });
    return {
        allUsers: allUsers,
        infoUser: infoUser
    }
};