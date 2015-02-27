module.exports = {
    game: 'test', // required, game name
    port: 8080,
    pingTimeout:100000,
    pingInterval:10000,
    logLevel:3,
    turnTime: 20,   // user turn time in seconds
    maxTimeouts: 1, // count user timeouts in game to lose
    ratingElo:true,
    mode: 'debug', // set developing mode, db isn't required
    gameModes: ['mode_1', 'mode_2'], // game modes, with different history, ratings, games, default is one mode ['default']
    modesAlias:{'mode_1':'mode first', 'mode_2': 'mode second'},
    db:{
        connectionLimit : 4,
        host            : 'localhost',
        user            : 'root',
        password        : 'root',
        database        : 'logicgame'
    },
    closeOldConnection: true
};