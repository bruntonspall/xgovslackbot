/*jshint esversion:6*/

const domains = require("./domains");
const format = require("./format");

if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

var botkitStoragePostgres = require('./pg_storage');
var Botkit = require('botkit');
var os = require('os');
var request = require('request');
var cfenv = require("cfenv");
var uuidv4 = require("uuid/v4");

if (!process.env.slackDomain) {
  var slackDomain = "ukgovernmentdigital";
} else {
  var slackDomain = process.env.slackDomain;
}

var secretWord = process.env.secretWord || "abracadabra";

var instanceId = uuidv4();
var started_claim = false;

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
  var pgEnv = appEnv.getServices()["my-pg-service"];
  var controller = Botkit.slackbot({
      debug: false,
      storage: botkitStoragePostgres({
        host: pgEnv.credentials.host,
        user: pgEnv.credentials.username,
        password: pgEnv.credentials.password,
        port: pgEnv.credentials.port,
        database: pgEnv.credentials.name,
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
      console.log('Failed to start RTM');
      return setTimeout(shutDown, 60000);
    }
    console.log("RTM started!");
  });
}

controller.on('rtm_close', function(bot, err) {
  shutDown();
});

function shutDown() {
  console.log("Shutting down");
  process.exit();
}

function reportInBotsChannel(message, cb) {
  return request.post({
    url: `https://${slackDomain}.slack.com/api/chat.postMessage`,
    form: {
      channel: '#bots-output',
      token: process.env.apitoken,
      username: bot.identity.name,
      icon_url:  "https://avatars.slack-edge.com/2017-06-12/196465304149_07a2c870e7ee855d6413_48.png",
      as_user: false,
      text: message
    }
  }, function(err, httpResponse, body) {
    if (cb) {
      body = JSON.parse(body);
      if (body.ok) {
        cb(undefined, body)
      } else {
        cb(body)
      }
    }
  });
}

controller.on('rtm_open', function(bot) {
  if (started_claim) return;
  started_claim = true;
  console.log("Claiming instance lock in postgres (id " + instanceId + ")");
  controller.storage.instance.claim(instanceId, function(err, currentInstanceId) {
    if (err) {
      console.log("Couldn't claim instance lock in database: " + err);
      reportInBotsChannel("Instance " + instanceId + " encountered an error trying to claim lock: " + err, (err, body) => shutDown());
    } else if (instanceId !== currentInstanceId) {
      console.log("Instance lock claimed by another process: " + currentInstanceId);
      reportInBotsChannel("Instance " + instanceId + " shutting down, lock claimed by " + currentInstanceId, (err, body) => shutDown());
    } else {
      reportInBotsChannel("Instance " + instanceId + " has claimed lock")
    }
  });
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
                if (body.ok) {
                  channel = {
                    id: body.channel.id,
                    name: body.channel.name,
                    announce: on,
                  };
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
});

controller.hears(['^announce (.*)'],
  'direct_mention', function(bot, message) {
    /* Currently in channel, and only the #bot-test channel */
    var channel = message.channel;
    var msgtext = message.match[1];
    var user = message.user;
    controller.log("Got asked to announce in "+channel+" by "+user+" with text: "+msgtext);
    controller.storage.channels.get(message.channel, function (err, channel) {
      if (channel && channel.announce) {
        request.post({
              url: `https://${slackDomain}.slack.com/api/chat.postMessage`,
              form: {
                channel: channel.id,
                token: process.env.apitoken,
                username: bot.identity.name,
                icon_url:  "https://avatars.slack-edge.com/2017-06-12/196465304149_07a2c870e7ee855d6413_48.png",
                as_user: false,
                text: "<!channel> "+msgtext+" (via <@"+user+">)"
              }
            });
        bot.replyInThread(message, "done");
      } else {
        bot.replyInThread(message, "Only for approved channels");
      }
    });
  }
);


controller.hears(['^invite.*\\|(.*)>'],
  'direct_message,direct_mention', function(bot, message) {
    var email = message.match[1];
    controller.log("Got an invite for email: "+email);
    if (!domains.hasApprovedEmail(email)) {
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
              bot.replyInThread(message, "Michael Bot-Spall doesn't have the rights to do that");
            } else if (body.error === "already_in_team") {
              bot.replyInThread(message, "That person is already invited");
            } else {
              bot.replyInThread(message, "Michael Bot-Spall got an error from slack: "+body.error);
            }
          }
        });
  });

controller.hears(['^uptime$', '^identify yourself$', '^who are you$', '^what is your name$'],
    'direct_message,direct_mention,mention', function(bot, message) {
        controller.log("Got asked for uptime");

        var hostname = os.hostname();
        var uptime = format.uptime(process.uptime());

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
        };
      }
      controller.storage.users.save(user, function(err, res) {
        bot.reply(message, "Set user "+user.id+" to "+user.role);
      });
    });
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
      bot.replyInThread(message, "You are a "+(user.role || "user"));
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
          /* falls through */
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
              };
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
      bot.replyInThread(message, "I don't know who you are I'm afraid");
    }
  });
});

controller.hears(["(https:\\/\\/www\\.civilservicejobs\\.service\\.gov\\.uk\\/csr\\/index\\.cgi\\?SID=[a-zA-Z0-9=]+)"], 'ambient,direct_message,direct_mention', function(bot, message) {
  bot.startConversation(message, function (err, convo) {
    const longUrl = message.match[1];
    request(longUrl, function (err, res, body) {
      if (err) return
      console.log(JSON.stringify(message));
      const matches = body.match(/https:\/\/www\.civilservicejobs\.service\.gov\.uk\/csr\/jobs\.cgi\?jcode=[0-9=]+/)
      if (matches.length > 0) {
        const shortUrl = matches[0];
        switch (message.type) {
          case 'direct_message':
          case 'direct_mention':
            convo.say({text: 'Here’s the shorter URL: ' + shortUrl});
            break;
          case 'ambient':
            convo.say({ephemeral: true, text: "Psst! You might want to use the shorter URL: "+matches[0]});
        }
      }
    });
  })
});

/**
 * Welcome new joiners with a private message from xgovslackbot
 */
function startIntroductionConversation(user) {
        bot.startPrivateConversation({
            user: user
        }, (err, convo) => {
            convo.say(
                // This is the message new joiners will get as a DM from the bot
                `Hello, Welcome to the cross government slack.  I'm ${bot.identity.name}, I'm a robot who can help you with a few things on this slack instance`);
            convo.say(
                'There are a lot of people from various departments on this slack instance, and it can be hard to know who you are!' +
                'Please add your organisation name to the end of your slack handle so that other users can easily see where you work. For example, `displayname_hmrc` or `displayname_dwp`.\n' +
                `You can change it here: https://${slackDomain}.slack.com/account/profile#display_name_profile_field\n` +
                'Please also update your profile to describe your role in the organisation, for example "Delivery manager at GDS".\n' +
                `You can edit your profile here: https://${slackDomain}.slack.com/account/profile\n`
            );
            convo.say(
                'If you were directed here to discuss Notify, then you might want to join #govuk-notify where the team can answer your questions');
            convo.say(
                'Finally, please remember that Slack, as are all digital communications that public servants use, is subject to FOI regulation. Please remember that things you write on here could be requested and released for the public.  We expect all members to abide by the civil service code for honesty, integrity, impartiality and objectivity');
            convo.say(
                'I can provide you with help on a few things. The main one is inviting your coworkers if they can\'t signup automatically.  Anybody with an email address that ends .gov.uk can be invited by replying to me saying `invite email@address`. I should reply to you telling them the invite has been sent.');
          convo.say("I respond to some other commands, message me 'help' or 'commands' for a list of them");
        });
}

controller.on('team_join', function(bot, message) {
  controller.log("User joined team: " + message.user);
  startIntroductionConversation(message.user.id);
});

controller.hears(["^welcome"], 'direct_mention,direct_message', function(bot, message) {
  controller.log("Asked to welcome " + message.user);
  startIntroductionConversation(message.user);
});

controller.hears(["^help","^commands"], "direct_message", function(bot, message) {
  bot.startConversation(message, function(err,convo) {
    TOPICS="I can tell you about:\nwelcome\ninvites\nannouncements\nroles\nWhich would you like to know more about? (say done when you are finished)";
    convo.addQuestion(TOPICS, [
      {
        pattern: 'welcome',
        callback: function(response, convo) {
          convo.say("If you say welcome in this private chat, I'll repeat the welcome message");
          convo.repeat();
          convo.next();
        }
      },
      {
        pattern: 'invites?',
        callback: function(response, convo) {
          convo.say("To invite someone to this slack, just say invite <email> in this private chat, or mentioned to me in a channel and I'll send an email to them to invite them.\nOnly people with domains in the following list will get an invite: " + domains.approvedDomainsString() + ".\nYou can submit a pull request to change the list in https://github.com/bruntonspall/xgovslackbot/blob/master/app/domains.js to add a domain I don't know about");
          convo.repeat();
          convo.next();
        }
      },
      {
        pattern: "announcements?",
        callback: function(response, convo) {
          convo.say("I can perform channel wide announcements.  You need to mention me in the channel you want an announcement, and say @${bot.identity.name} announce my message here.\n" +
            "I'll then repeat in channel something like \"@channel my message here\"\n" +
            "Because this could be abused, it must be done in channel (so everyone sees you do it) and it has to be enabled for each channel");
          convo.repeat();
          convo.next();
        }
      },
      {
        pattern: "roles?",
        callback: function(response, convo) {
          convo.say("There are 3 user roles that I recognise, User, Admin and SuperAdmin\nIf you ask me 'what role am i?', I'll let you know\nAdmins can set a channel to allow announcements by telling me 'channel_announce #channel on' or 'off' to toggle the announce functions\nSuperAdmins can create admins by telling me 'set role for @name to admin'.");
          convo.repeat();
          convo.next();
        }
      },
      {
        pattern: "done",
        callback: function(response, convo) {
          convo.say("Ok, I hope I was helpful");
          convo.next();
        }
      },
      {
        default: true,
        callback: function(response, convo) {
          convo.say("I didn't understand that, so I assume you are done");
          convo.next();
        }
      }
    ], {}, 'default');

    /* timeout the conversation after 2 minutes of inactivity */
    convo.setTimeout(1000*120);
    convo.onTimeout(function(convo) {
      convo.say("You've been quiet for a while. I'm going to assume that you have what you need for now. Bye!");
      convo.next();
    });
  });
});

controller.hears(['weather', 'wx'], 'direct_mention,direct_message', (bot, message) => {
  bot.replyInThread(message, "Checkin' the weather for you now 🌞");
  const heard_word = message.text.split(" ")[1];
  const location = message.text.split(heard_word)[1];
  /**
   * The Glitch app is written by Jake Hendy (@JakeHendy) and accesses the Met Office Weather DataHub, as well as
   * its own internal, semi-public Gazetteer. 
   * The GlitchApp returns an object containing a `blocks` property, which is fed straight through as the response.
   */
  request.get({url: 'https://slack-wdh-gaz.glitch.me/weather?location=' + location, json: true }, (error, response, body) => {
    bot.reply(message, body);
  })
})