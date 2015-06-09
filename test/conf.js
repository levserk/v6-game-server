module.exports = {
    game: 'test2', // required, game name
    port: 8078,
    pingTimeout: 100000,
    pingInterval: 10000,
    logLevel: 3,
    turnTime: 5,   // user turn time in seconds
    maxTimeouts: 2, // count user timeouts in game to lose
    minTurns: 0,
    takeBacks: 1,
    loadRanksInRating: true,
    penalties: true,
    mode: 'develop', // set developing mode, db isn't required
    gameModes: ['mode_1', 'mode_2'], // game modes, with different history, ratings, games, default is one mode ['default']
    modesAlias:{'mode_1':'mode first', 'mode_2': 'mode second'},
    adminList: ['448039'],
    adminPass: '1'
};