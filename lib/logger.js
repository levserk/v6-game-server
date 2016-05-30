var Logger = {};
Logger.logLevel = 1;

Logger._log = function() {
     var level = Array.prototype.pop.apply(arguments);
     Array.prototype.unshift.call(arguments, getTime());
    if (level <= this.logLevel) {
        console.log.apply(console, arguments);
    }
};

Logger.log = function() {
    Array.prototype.unshift.call(arguments, '- log;');
    Logger._log.apply(Logger, arguments);
};


Logger.err = function() {
    Array.prototype.unshift.call(arguments, '- err;');
    Logger._log.apply(Logger, arguments);
};


Logger.warn = function() {
    Array.prototype.unshift.call(arguments, '- wrn;');
    Logger._log.apply(Logger, arguments);
};

function getTime() {
    var month_names_short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        time = '', d = new Date() ,t;
    t = d.getDate();
    time += (t < 10 ? '0' : '') + t;
    t = month_names_short[d.getMonth()];
    time += ' ' + t;
    t = d.getHours();
    time += ' '+(t < 10 ? '0' : '') + t;
    t = d.getMinutes();
    time += ':'+(t < 10 ? '0' : '') + t;
    t = d.getSeconds();
    time += ':'+(t < 10 ? '0' : '') + t;

    return time;
}

module.exports = Logger;