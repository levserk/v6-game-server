module.exports = {
    game: 'test',
    port: 8080,
    pingTimeout:100000,
    pingInterval:50000,
    logLevel:3,
    db:{
        connectionLimit : 2,
        host            : 'localhost',
        user            : 'root',
        password        : 'root'
    },
    closeOldConnection:true
};