module.exports = {
    game: 'test',
    port: 8080,
    pingTimeout:20000,
    pingInterval:5000,
    logLevel:3,
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