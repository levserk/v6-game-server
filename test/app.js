var Server = require('../index.js'),
    engine = {
       /*
        engine functions
         */
    },
    conf = {
        game: 'test',
        port: 8080,
        pingTimeout:100000,
        pingInterval:50000,
        logLevel:3
    },
    server = new Server(conf, engine);

server.start();