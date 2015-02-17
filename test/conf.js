module.exports = {
    game: 'test', // required, game name
    port: 8080,
    pingTimeout:100000,
    pingInterval:10000,
    logLevel:3,
    turnTime: 10,   // user turn time in seconds
    maxTimeouts: 1, // count user timeouts in game to lose
    ratingElo:true,
    mode: 'test', // set developing mode, db isn't required
    gameModes: ['mode 1', 'mode 2'], // game modes, with different history, ratings, games, default is one mode ['default']
    db:{
        connectionLimit : 4,
        host            : 'localhost',
        user            : 'root',
        password        : 'root',
        database        : 'logicgame'
    },
    closeOldConnection: true
};