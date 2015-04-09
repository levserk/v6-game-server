module.exports = {
    game: 'default',        // required, game name
    port: 8080,             //
    pingTimeout:100000,     //
    pingInterval:10000,     //
    closeOldConnection: true,
    loseOnLeave: false,     // player lose game or not after leave
    reconnectOldGame: true, // continue old game on reconnect or auto leave
    spectateEnable: true,   // on/off spectate games
    logLevel:3,             // 0 - nothing, 1 - errors and warns, 2 - important, 3 and more - others
    turnTime: 10,           // user turn time in seconds
    maxTimeouts: 1,         // count user timeouts in game to lose
    minTurns: 0,            // count switches players to save game
    ratingElo: true,        // compute rating elo flag
    ratingUpdateInterval: 1000, // how often update ranks in users array
    mode: 'debug',          // set developing mode, 'develop', without db
    gameModes: ['default'], // game modes, with different history, ratings, games, default is one mode ['default'],
                            // space isn't
    modesAlias:{default:'default'}, // visible client mode alias
    adminList: [],
    mongo:{                 // mongodb configuration
        host: '127.0.0.1',
        port: '27017'
    }
};