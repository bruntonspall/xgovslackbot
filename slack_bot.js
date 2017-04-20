
if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

var botkitStoragePostgres = require('./pg_storage');
var Botkit = require('botkit');
var os = require('os');
var request = require('request');
var cfenv = require("cfenv");

if (!process.env.slackDomain) {
  var slackDomain = "ukgovernmentdigital";
} else {
  var slackDomain = process.env.slackDomain;
}

var secretWord = process.env.secretWord || "abracadabra";

var appEnv = cfenv.getAppEnv();
if (appEnv.isLocal) {
  var controller = Botkit.slackbot({
      debug: true,
      storage: botkitStoragePostgres({
        host: "localhost",
        user: "xgovslackbot",
        password: "xgovslackbot",
        database: "xgovslackbot",
        ssl: false,
      })
  });
} else {
  var pgEnv = appEnv.getServices();
  var controller = Botkit.slackbot({
      debug: false,
      storage: botkitStoragePostgres({
        host: pgEnv["my-pg-service"]["credentials"]["host"],
        user: pgEnv["my-pg-service"]["credentials"]["username"],
        password: pgEnv["my-pg-service"]["credentials"]["password"],
        port: pgEnv["my-pg-service"]["credentials"]["port"],
        database: pgEnv["my-pg-service"]["credentials"]["name"],
        ssl: true,
      })
  });
}

controller.setupWebserver(process.env.PORT || 3000,function(err,webserver) {

  // // set up web endpoints for oauth, receiving webhooks, etc.
  // controller
  //   .createOauthEndpoints(controller.webserver,function(err,req,res) { ... })
  //   .createWebhookEndpoints(controller.webserver);

  controller.webserver.get('/', function(req, res) {
        res.send('<p>Welcome to X-Gov-Slack bot</p>'+
        `<p><a href="https://${slackDomain}.slack.com">Sign up</a></p>`);
    });
  controller.webserver.get('/users', function(req, res) {
    controller.storage.users.all(function(err, users){
      s = "";
      s += '<h1>User database</h1>';

      for (var i = 0; i < users.length; ++i) {
        s += "<p>"+JSON.stringify(users[i])+"</p>";
      }
      res.send(s);
    });
  });
  controller.webserver.get('/channels', function(req, res) {
    controller.storage.channels.all(function(err, channels){
      s = "";
      s += '<h1>Channel database</h1>';

      for (var i = 0; i < channels.length; ++i) {
        s += "<p>"+JSON.stringify(channels[i])+"</p>";
      }
      res.send(s);
    });
  });
});

var bot = controller.spawn({
    token: process.env.token
});

function start_rtm() {
  bot.startRTM(function(err,bot,payload) {
    if (err) {
      console.log('Failed to start RTM')
      return setTimeout(start_rtm, 60000);
    }
    console.log("RTM started!");
  });
};

controller.on('rtm_close', function(bot, err) {
        start_rtm();
});

start_rtm();

controller.hears(['^hello', '^hi'], 'direct_message,direct_mention,mention', function(bot, message) {
  controller.log("Hello from "+message.user+" in channel "+message.channel);

    bot.api.reactions.add({
        timestamp: message.ts,
        channel: message.channel,
        name: 'robot_face',
    }, function(err, res) {
        if (err) {
            bot.botkit.log('Failed to add emoji reaction :(', err);
        }
    });


    controller.storage.users.get(message.user, function(err, user) {
        if (user && user.name) {
            bot.replyInThread(message, 'Hello ' + user.name + '!!');
        } else {
            bot.replyInThread(message, 'Hello '+message.user);
        }
    });
});

controller.hears(['^call me (.*)', '^my name is (.*)'], 'direct_message,direct_mention,mention', function(bot, message) {
    var name = message.match[1];
    controller.storage.users.get(message.user, function(err, user) {
        if (!user) {
            user = {
                id: message.user,
                role: "user",
                name: name
            };
        }
        user.name = name;
        controller.storage.users.save(user, function(err, id) {
            bot.replyInThread(message, 'Got it. I will call you ' + user.name + ' from now on.');
        });
    });
});

controller.hears(['^channel_announce <#(.*)\\|.*> o(n|f)f?'], 'direct_mention', function(bot, message) {
  var channame = message.match[1];
  var on = message.match[2] === "n";
  controller.storage.users.get(message.user, function(err, user) {
    if (!user) {
      bot.replyInThread(message, "Only admins can do that");
    } else {
      if (!user.role || user.role == "user") {
        bot.replyInThread(message, "Only admins can do that, and you are just a "+user.role);
        return;
      }
      controller.log("Channel Announce toggle for "+channame+" set to "+on);
      controller.storage.channels.get(channame, function (err, channel) {
        if (!channel) {
          controller.log("Channel data not found.  Creating");
          // The channel hasn't been seen before, so create and save it
          request.post({
                url: `https://${slackDomain}.slack.com/api/channels.info`,
                form: {
                  channel: channame,
                  token: process.env.apitoken,
                }
              }, function(err, httpResponse, body) {
                controller.log("Channel info: "+body);
                body = JSON.parse(body);
                if (body["ok"]) {
                  channel = {
                    id: body["channel"]["id"],
                    name: body["channel"]["name"],
                    announce: on,
                  }
                  controller.storage.channels.save(channel, function(err, id) {
                    bot.replyInThread(message, "Got it, "+channel.name+" ("+id+") is now set for announce = "+on);
                  });
                }
              });
        } else {
          controller.log("Channel data found.  Updating");
          channel.announce = on;
          controller.storage.channels.save(channel, function(err, id) {
            bot.replyInThread(message, "Got it, "+channel.name+" ("+id+") is now set for announce = "+on);
          });
        }
      });
    }
  });
})

controller.hears(['^announce (.*)'],
  'direct_mention', function(bot, message) {
    /* Currently in channel, and only the #bot-test channel */
    var channel = message.channel;
    var msgtext = message.match[1];
    var user = message.user
    controller.log("Got asked to announce in "+channel+" by "+user+" with text: "+msgtext);
    controller.storage.channels.get(message.channel, function (err, channel) {
      if (channel && channel.announce) {
        request.post({
              url: `https://${slackDomain}.slack.com/api/chat.postMessage`,
              form: {
                channel: channel.id,
                token: process.env.apitoken,
                username: "thegovernor",
                icon_url:  "https://avatars.slack-edge.com/2017-04-04/164801788790_e3902f9310191c6ea722_72.png",
                as_user: false,
                text: "<!channel> "+msgtext+" (via <@"+user+">)"
              }
            });
        bot.replyInThread(message, "done");
      } else {
        bot.replyInThread(message, "Only for approved channels");
      }
    })
  }
)


controller.hears(['^invite.*\\|(.*)>'],
  'direct_message,direct_mention', function(bot, message) {
    var email = message.match[1];
    controller.log("Got an invite for email: "+email);
    if (!hasApprovedEmailDomain(email)) {
      bot.replyInThread(message, "I only send invites to people with GOV.UK or otherwise approved email address");
      return;
    }
    request.post({
          url: `https://${slackDomain}.slack.com/api/users.admin.invite`,
          form: {
            email: email,
            token: process.env.apitoken,
            set_active: true
          }
        }, function(err, httpResponse, body) {
          // body looks like:
          //   {"ok":true}
          //       or
          //   {"ok":false,"error":"already_invited"}
          if (err) { return res.send('Error:' + err); }
          body = JSON.parse(body);
          if (body.ok) {
            bot.replyInThread(message, "Invite sent, tell them to check their email");
          } else {
            if (body.error === "invalid_email") {
              bot.replyInThread(message, "The email is not valid.  Email: "+message.match[1]);
            } else if (body.error === "invalid_auth") {
              bot.replyInThread(message, "The Governor doesn't have the rights to do that");
            } else if (body.error === "already_in_team") {
              bot.replyInThread(message, "That person is already invited");
            } else {
              bot.replyInThread(message, "The Governor got an error from slack: "+body.error);
            }
          }
        });
  });

controller.hears(['^uptime$', '^identify yourself$', '^who are you$', '^what is your name$'],
    'direct_message,direct_mention,mention', function(bot, message) {
        controller.log("Got asked for uptime");

        var hostname = os.hostname();
        var uptime = formatUptime(process.uptime());

        bot.replyInThread(message,
            ':robot_face: I am a bot named <@' + bot.identity.name +
             '>. I have been running for ' + uptime + ' on ' + hostname + '.');

});

controller.hears(["^superme (.*)"], "direct_message", function(bot, message) {
  if (message.match[1] == secretWord) {
    controller.log("Setting user "+message.user+" as superuser");
    controller.storage.users.get(message.user, function(err, user) {
      if (user) {
        user.role = "super";
      } else {
        user = {
          id: message.user,
          role: "super"
        }
      }
      controller.storage.users.save(user, function(err, res) {
        bot.reply(message, "Set user "+user.id+" to "+user.role);
      })
    })
  } else {
    bot.reply(message, "Uh uh uh.  You didn't say the magic word!");
  }
});

controller.hears(["^what role am i"], 'direct_mention,direct_message', function(bot, message) {
  controller.log("Got asked for the role for "+message.user);
  controller.storage.users.get(message.user, function(err, user) {
    if (!user) {
      bot.replyInThread(message, "You are a user");
    } else {
      bot.replyInThread(message, "You are a "+(user.role || "user"))
    }
  });
});

controller.hears(["^set role for <@(.*)> to (.*)"], 'direct_mention,direct_message', function(bot, message) {
  controller.log("set role message: "+message.match);
  targetUser = message.match[1];
  newRole = message.match[2];
  controller.log("Got asked for the role for "+message.user);
  controller.storage.users.get(message.user, function(err, user) {
    if (user) {
      switch (user.role) {
        case "admin":
          if (!(newRole == "user" || newRole == "admin")) {
            bot.replyInThread(message, "You can't set a user to that role");
            return;
          }
          // else dropthrough
        case "super":
          controller.storage.users.get(targetUser, function(err, user) {
            if (user) {
              user.role = newRole;
              controller.storage.users.save(user, function(err, res) {
                bot.replyInThread(message, "Set user "+user.id+" to "+user.role);
              });
            } else {
              user = {
                id: targetUser,
                role: newRole
              }
              controller.storage.users.save(user, function(err, res) {
                bot.replyInThread(message, "Set user "+user.id+" to "+user.role);
              });
            }
          });
          break;
        default:
          bot.replyInThread(message, "Your role of "+user.role+" is not recognised");
      }
    } else {
      bot.replyInThread(message, "I don't know who you are I'm afraid")
    }
  });
});

function hasApprovedEmailDomain(email) {
  if (email.match(".*gov\.uk$")) {
    return true;
  }
  return false;
}

function formatUptime(uptime) {
    var unit = 'second';
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'minute';
    }
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'hour';
    }
    if (uptime != 1) {
        unit = unit + 's';
    }

    uptime = uptime + ' ' + unit;
    return uptime;
}
