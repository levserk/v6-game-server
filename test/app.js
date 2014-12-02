var Server = require('../index.js'),
    engine = {
       /*
        engine functions
         */
    },
    conf = {
        game: 'test',
        port: 8080,
        pingTimeout:10000,
        pingInterval:5000,
        logLevel:3
    },
    server = new Server(conf, engine);

server.start();
