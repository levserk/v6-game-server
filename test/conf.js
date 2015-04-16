module.exports = {
    game: 'test2', // required, game name
    port: 8078,
    pingTimeout: 100000,
    pingInterval: 10000,
    logLevel: 3,
    turnTime: 60,   // user turn time in seconds
    maxTimeouts: 1, // count user timeouts in game to lose
    minTurns: 0,
    takeBacks: 1,
    mode: 'develop1', // set developing mode, db isn't required
    gameModes: ['mode_1', 'mode_2'], // game modes, with different history, ratings, games, default is one mode ['default']
    modesAlias:{'mode_1':'mode first', 'mode_2': 'mode second'},
    adminList: ['85505'],
    db:{
        connectionLimit : 4,
        host            : 'localhost',
        user            : 'root',
        password        : 'root',
        database        : 'logicgame'
    }
};