/*jshint esversion:6*/

var approvedDomains = [
  /.*@(.*\.)?gov.uk$/,
  /.*@(.*\.)?naturalengland.org.uk$/,
  /.*@(.*\.)?bankofengland.co.uk$/,
  /.*@(.*\.)?cqc.org.uk$/,
  /.*@(.*\.)?nhs.net$/,
  /.*@(.*\.)?sepa.org.uk$/
  /.*@(.*\.)?justice.gov.uk$/
];

function hasApprovedEmail(email) {
  return approvedDomains.reduce(function(previous, domain) {
    return previous || domain.test(email);
  }, false);
}

module.exports.hasApprovedEmail = hasApprovedEmail;
