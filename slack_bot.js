
if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

var botkitStoragePostgres = require('./pg_storage');
var Botkit = require('botkit');
var os = require('os');
var request = require('request');
var cfenv = require("cfenv");
var appEnv = cfenv.getAppEnv();
if (appEnv.isLocal) {
  var controller = Botkit.slackbot({
      debug: true,
      storage: botkitStoragePostgres({
        host: "localhost",
        user: "xgovslackbot",
        password: "xgovslackbot",
        database: "xgovslackbot"
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
        '<p><a href="https://ukgovernmentdigital.slack.com">Sign up</a></p>');
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
}).startRTM();

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
            bot.reply(message, 'Hello ' + user.name + '!!');
        } else {
            bot.reply(message, 'Hello '+message.user);
        }
    });
});

controller.hears(['call me (.*)', 'my name is (.*)'], 'direct_message,direct_mention,mention', function(bot, message) {
    var name = message.match[1];
    controller.storage.users.get(message.user, function(err, user) {
        if (!user) {
            user = {
                id: message.user,
            };
        }
        user.name = name;
        controller.storage.users.save(user, function(err, id) {
            bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
        });
    });
});

controller.hears(['what is my name', 'who am i'], 'direct_message,direct_mention,mention', function(bot, message) {

    controller.storage.users.get(message.user, function(err, user) {
        if (user && user.name) {
            bot.reply(message, 'Your name is ' + user.name);
        } else {
            bot.startConversation(message, function(err, convo) {
                if (!err) {
                    convo.say('I do not know your name yet!');
                    convo.ask('What should I call you?', function(response, convo) {
                        convo.ask('You want me to call you `' + response.text + '`?', [
                            {
                                pattern: 'yes',
                                callback: function(response, convo) {
                                    // since no further messages are queued after this,
                                    // the conversation will end naturally with status == 'completed'
                                    convo.next();
                                }
                            },
                            {
                                pattern: 'no',
                                callback: function(response, convo) {
                                    // stop the conversation. this will cause it to end with status == 'stopped'
                                    convo.stop();
                                }
                            },
                            {
                                default: true,
                                callback: function(response, convo) {
                                    convo.repeat();
                                    convo.next();
                                }
                            }
                        ]);

                        convo.next();

                    }, {'key': 'nickname'}); // store the results in a field called nickname

                    convo.on('end', function(convo) {
                        if (convo.status == 'completed') {
                            bot.reply(message, 'OK! I will update my dossier...');

                            controller.storage.users.get(message.user, function(err, user) {
                                if (!user) {
                                    user = {
                                        id: message.user,
                                    };
                                }
                                user.name = convo.extractResponse('nickname');
                                controller.storage.users.save(user, function(err, id) {
                                    bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
                                });
                            });



                        } else {
                            // this happens if the conversation ended prematurely for some reason
                            bot.reply(message, 'OK, nevermind!');
                        }
                    });
                }
            });
        }
    });
});

controller.hears(['^channel_announce <#(.*)\\|.*> o(n|f)f?'], 'direct_mention,direct_message', function(bot, message) {
  var channame = message.match[1];
  var on = message.match[2] === "n";
  controller.log("Channel Announce toggle for "+channame+" set to "+on);
  controller.storage.channels.get(channame, function (err, channel) {
    if (!channel) {
      controller.log("Channel data not found.  Creating");
      // The channel hasn't been seen before, so create and save it
      request.post({
            url: 'https://ukgovernmentdigital.slack.com/api/channels.info',
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
                bot.reply(message, "Got it, "+channel.name+" ("+id+") is now set for announce = "+on);
              });
            }
          });
    } else {
      controller.log("Channel data found.  Updating");
      channel.announce = on;
      controller.storage.channels.save(channel, function(err, id) {
        bot.reply(message, "Got it, "+channel.name+" ("+id+") is now set for announce = "+on);
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
              url: 'https://ukgovernmentdigital.slack.com/api/chat.postMessage',
              form: {
                channel: channel.id,
                token: process.env.apitoken,
                username: "thegovernor",
                icon_url:  "https://avatars.slack-edge.com/2017-04-04/164801788790_e3902f9310191c6ea722_72.png",
                as_user: false,
                text: "<!channel> "+msgtext+" (via <@"+user+">)"
              }
            });
        bot.reply(message, "done");
      } else {
        bot.reply(message, "Only for approved channels");
      }
    })
  }
)


controller.hears(['^invite.*\\|(.*)>'],
  'direct_message,direct_mention', function(bot, message) {
    var email = message.match[1];
    controller.log("Got an invite for email: "+email);
    if (!hasApprovedEmailDomain(email)) {
      bot.reply(message, "I only send invites to people with GOV.UK or otherwise approved email address");
      return;
    }
    request.post({
          url: 'https://ukgovernmentdigital.slack.com/api/users.admin.invite',
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
            bot.reply(message, "Invite sent, tell them to check their email");
          } else {
            if (body.error === "invalid_email") {
              bot.reply(message, "The email is not valid.  Email: "+message.match[1]);
            } else if (body.error === "invalid_auth") {
              bot.reply(message, "The Governor doesn't have the rights to do that");
            } else if (body.error === "already_in_team") {
              bot.reply(message, "That person is already invited");
            } else {
              bot.reply(message, "The Governor got an error from slack: "+body.error);
            }
          }
        });
  });

controller.hears(['uptime', 'identify yourself', 'who are you', 'what is your name'],
    'direct_message,direct_mention,mention', function(bot, message) {
        controller.log("Got asked for uptime");

        var hostname = os.hostname();
        var uptime = formatUptime(process.uptime());

        bot.reply(message,
            ':robot_face: I am a bot named <@' + bot.identity.name +
             '>. I have been running for ' + uptime + ' on ' + hostname + '.');

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
