function uptime(uptime) {
    var hours = Math.floor(uptime / 3600);
    var minutes = Math.floor((uptime - hours*3600) / 60)
    var seconds = uptime - hours*3600 - minutes*60
    var uptimestring = ""
    if (hours > 0) {
        uptimestring += hours + ' ' + 'hour';
        if (hours > 1) {
            uptimestring += "s";
        }
    }
    if (minutes > 0) {
        if (hours > 0) {
            uptimestring += ", ";
        }
        uptimestring += minutes + ' ' + 'minute';
        if (minutes > 1) {
            uptimestring += "s";
        }
    }
    if (seconds > 0) {
        if (minutes > 0 || hours > 0) {
            uptimestring += ", ";
        }
        uptimestring += seconds + ' ' + 'second';
        if (seconds > 1) {
            uptimestring += "s";
        }
    }    
    return uptimestring;
}

module.exports.uptime = uptime