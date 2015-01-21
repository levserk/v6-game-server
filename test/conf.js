module.exports = {
    game: 'test',
    port: 8080,
    pingTimeout:100000,
    pingInterval:10000,
    logLevel:3,
    turnTime: 10,
    maxTimeouts:1,
    db:{
        connectionLimit : 4,
        host            : 'localhost',
        user            : 'root',
        password        : 'root',
        database        : 'logicgame'
    },
    closeOldConnection: true,
    mode: 'test'
};