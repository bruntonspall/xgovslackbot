# X-Gov-Slack-Bot

This is a bot for helping administrate a shared slack channel for the UK Government.

It's pretty damn unofficial, and just automates a few tasks that needed automating. It's maintained by @bruntonspall in his copious spare time and runs on the GOV.UK PaaS

## Running your own copy

You'll need a few things:

1. A slack domain, I use mbs-bot-test as a test channel, feel free to create your own or ask politely for access
2. A bot integration
3. A legacy api token

### Create a slack domain

Just go to slack.com and create a new slack instance, or ask @bruntonspall nicely to use mbs-bot-test

### Creating a bot integration

Now make a bot integration inside of your Slack channel. Go here:

https://my.slack.com/services/new/bot

Enter a name for your bot. Make it something fun and friendly, but avoid a single task specific name. Bots can do lots! Let's not pigeonhole them.

When you click "Add Bot Integration", you are taken to a page where you can add additional details about your bot, like an avatar, as well as customize its name & description.
Copy the API token that Slack gives you. You'll need it.

### Getting a legacy API token

You'll also need a legacy API token, go get one from https://api.slack.com/custom-integrations/legacy-tokens, it should start `xoxp`

## Starting it up

You'll want to run the following command
```nodejs token=xoxb-... apitoken=xoxp-... slackdomain=... ./index.js```

Your bot should appear on the slack channel and you should be able to interact with him/her/it as expected

# Using the bot

On the Cross Government Slack instance, the bot is called michaelbotspall and it's pronouns are it/it's/it's.

It can do two main tasks.

## Inviting people to join

Our slack is limited to UK Government Employees, but slack restricts the number fo domains to just 100, so the bot can issue per user invites.  You can simply message it with `invite email@address` and it will send an invite, providing the email address is valid.

You can either message the bot direct, or address is in a channel, like `@michaelbotspall invite michael@gov.uk`.  It will reply in a thread to say it has sent the invite.

Currently invites are only sent to people with email addresses ending `.gov.uk`.

## Making an announcement

Slacks current system allows either everyone to make announcements everywhere, or only the admin to make announcements everywhere.

MichaelBotSpall has the power to make announcements in select channels, simply say, in channel, `@michaelbotspall announce some words here` and @michaelbotspall will follow up with `@channel some words here (via @bruntonspall)` with your name.  This makes the identity of the user explicit and clear.

This is only enabled for certain channels, so to enable it for a new channel, simply say `@michaelbotspall channel_announce #general on` and it will enable announcements in #general.  To turn announcements off, say `@michaelbotspall channel_announce #general off` and it will do so.

# Other features

MichaelBotSpall has a few other features:

* User roles, simply say `@michaelbotspall set role for @user to admin` to grant admin roles to a user.  Only super users can do this, and only admins can toggle channel announcements
* Uptime, simply say `@michaelbotspall uptime` and it will tell you how long it has been running
* Politeness, simply say `@michaelbotspall hello` and it will say hello back
* Name calling, say `@michaelbotspall call me maybe` and it will call you `maybe` when it says hello :)

# Future feature ideas

I'd like to steal some features from https://handbook.18f.gov/slack/ and provide some helpful features in future, such as raising issues on github for documentation, arranging standups, reminders etc.
