var Server = require('../index.js'),
    engine = require('./engine.js'),
    conf = require('./conf.js'),
    server = new Server(conf, engine);

server.start();