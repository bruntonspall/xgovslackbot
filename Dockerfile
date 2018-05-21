from node:9
label maintainer="michael@brunton-spall.co.uk"
ARG BOTKIT_STORAGE_POSTGRES_HOST=localhost
ENV token=xoxb-token apitoken=xoxp-apitoken slackdomain=mbs-bot-test.slack.com
copy . /usr/src/xgovslackbot
workdir /usr/src/xgovslackbot
run npm install --only=dev
run BOTKIT_STORAGE_POSTGRES_HOST=$BOTKIT_STORAGE_POSTGRES_HOST npm test
