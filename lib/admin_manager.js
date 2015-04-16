var logger = require('./logger.js');

module.exports = AdminManager;

function AdminManager(server){
    this.server = server;
}


AdminManager.prototype.onMessage = function(message, type){
    var data = message.data;
    var pass = data.pass;
    var admin = message.sender;
    if (!this.checkAuth(admin, pass)) return;
    switch (type){
        case 'reboot':
            this.reboot(admin, data.data);
            break;
        case 'log_level':
            this.setLogLevel(admin, data.data);
            break;
        case 'message':
            this.sendMessage(admin, data.data);
            break;
        case 'enable_games':
            this.enableGames(admin, data.data);
            break;
        case 'reload':
            this.reloadClients(admin, data.data);
            break;
    }
};

AdminManager.prototype.checkAuth = function(user, pass){
    user.wrongAuthAttempts = user.wrongAuthAttempts || 0;

    if (pass !== this.server.conf.adminPass){
        logger.warn('AdminManager.checkAuth', 'wrong pass', user.userId, user.userName, pass, 1);
        user.wrongAuthAttempts++;
        return false
    }

    if (user.wrongAuthAttempts > 2) {
        logger.warn('AdminManager.checkAuth', 'auth attempts limit', user.userId, user.userName, 1);
        return false;
    }

    return true;
};


AdminManager.prototype.reboot = function(user) {
    logger.warn('AdminManager.reboot', 'reboot game server', user.userId, user.userName, 1);
    process.exit(1);
};


AdminManager.prototype.setLogLevel = function(user, level) {
    level = +level;
    if (!level && level !== 0) return;
    logger.warn('AdminManager.setLogLevel', user.userId, user.userName, level, 1);
    logger.logLevel = level;
};


AdminManager.prototype.sendMessage = function(user, message) {
    logger.warn('AdminManager.sendMessage', 'message', user.userId, user.userName, message, 1);
    if (typeof message != 'string') return;
    this.server.router.send({
        module: 'admin',
        type: 'message',
        target: this.server.game,
        data: message
    })
};


AdminManager.prototype.enableGames = function(user, flag) {
    flag = !!flag;
    logger.warn('AdminManager.enableGames', user.userId, user.userName, flag, 1);
    this.server.router.send({
        module: 'admin',
        type: 'enable_games',
        target: this.server.game,
        data: {flag: flag}
    });
    this.server.gameManager.enableGames = flag;
};


AdminManager.prototype.reloadClients = function(user) {
    logger.warn('AdminManager.reloadClients', user.userId, user.userName, 1);
    this.server.router.send({
        module: 'admin',
        type: 'reload',
        target: this.server.game,
        data: true
    });
};