from node:8
label maintainer="michael@brunton-spall.co.uk"
label uk.co.brunton-spall.version="0.0.1-beta"
ENV token=xoxb-token apitoken=xoxp-apitoken slackdomain=mbs-bot-test.slack.com
copy . /usr/src/xgovslackbot
workdir /usr/src/xgovslackbot
run npm install --dev
run npm test .
