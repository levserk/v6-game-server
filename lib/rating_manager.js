var util = require('util');
var math = require('math');
module.exports = RatingManager;

function RatingManager(server){

    var self = this;
    this.server = server;
    this.timeLastUpdate = null;
    this.interval = server.conf.ratingUpdateInterval;
    this.updating = false;
}


RatingManager.prototype.onMessage = function(message, type){
    var self = this, data;
    switch (type) {
        case 'ratings': // load history
            data = message.data;
            data.column = data.column || 'ratingElo';
            data.order = data.order || 'desc';
            data.mode = data.mode || this.server.modes[0];
            this.server.storage.getRatings(message.sender.userId, data)
                .then(function(ratings){
                    self.server.router.send({
                            module: 'rating_manager',
                            type: 'ratings',
                            target: message.sender,
                            data: {
                                mode: data.mode,
                                column: data.column,
                                order: data.order,
                                ratings: ratings
                            }
                        }
                    );
                })
                .catch(function(err){ // return null
                    util.log('err;', 'RatingManager.loadRatings', err);
                    self.server.router.send({
                            module: 'rating_manager',
                            type: 'ratings',
                            target: message.sender,
                            data: {
                                mode: data.mode,
                                column: data.column,
                                order: data.order,
                                ratings: {
                                    allUsers: [],
                                    infoUser: null
                                }
                            }
                        }
                    );
                });
            break;
    }
};


RatingManager.prototype.computeNewRatings = function (room, result, callback){
    util.log('log;', 'RatingManager.computeNewRatings', room.id,' compute: ', room.saveRating);
    if (!room.saveRating) {
        callback();
        return;
    }
    var mode = room.mode, winner, loser, self = this;
    if (result.winner == room.players[0].userId){
        winner = room.players[0];
        loser = room.players[1];
    } else {
        winner = room.players[1];
        loser = room.players[0];
    }
    winner[mode]['games']++;
    loser[mode]['games']++;
    winner[mode]['timeLastGame'] = loser[mode]['timeLastGame'] =  Date.now();

    if (!result.winner) {
        winner[mode]['draw']++;
        loser[mode]['draw']++;

    } else {
        winner[mode]['win']++;
        loser[mode]['lose']++;
        if (this.server.conf.ratingElo) this.computeNewElo(mode, winner, loser);
    }

    this.server.storage.saveUsers(room.players, mode, function () {
        if (!self.updating && (!self.timeLastUpdate || !self.interval
            || Date.now() - self.timeLastUpdate > self.interval)) {
            self.updating = true;
            var startTime = Date.now();
            self.server.storage.updateRatings(mode)
                .then(function(result){
                    self.updating = false;
                    self.timeLastUpdate = Date.now();
                    util.log('log;', 'RatingManager.computeNewRatings', 'ranks updated', result.length, ' time: ',Date.now() - startTime);
                })
                .catch(function (err){
                    self.updating = false;
                    util.log('log;', 'RatingManager.computeNewRatings', 'ranks updating failed', err);
                });
        }
        callback();
    });
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