/*jshint esversion:6*/

var approvedDomains = [
  /.*@(.*\.)?acas.org.uk$/,
  /.*@(.*\.)?apha.gsi.gov.uk$/,
  /.*@(.*\.)?bankofengland.co.uk$/,
  /.*@(.*\.)?bl.uk$/,
  /.*@(.*\.)?bmtdsl.co.uk$/,
  /.*@(.*\.)?cqc.org.uk$/,
  /.*@(.*\.)?ddc-mod.org$/,
  /.*@(.*\.)?digital.nhs.uk$/,
  /.*@(.*\.)?gov.scot$/,
  /.*@(.*\.)?gov.uk$/,
  /.*@(.*\.)?hee.nhs.uk$/,
  /.*@(.*\.)?hmcts.net$/,
  /.*@(.*\.)?hs2.org.uk$/,
  /.*@(.*\.)?marinemanagement.org.uk$/,
  /.*@(.*\.)?mod.uk$/,
  /.*@(.*\.)?naturalengland.org.uk$/,
  /.*@(.*\.)?nhs.net$/,
  /.*@(.*\.)?nhsbt.nhs.uk$/,
  /.*@(.*\.)?nice.org.uk$/,
  /.*@(.*\.)?os.uk$/,
  /.*@(.*\.)?parliament.uk$/,
  /.*@(.*\.)?sepa.org.uk$/,
  /.*@(.*\.)?slc.co.uk$/,
  /.*@(.*\.)?stfc.ac.uk$/
];

function hasApprovedEmail(email) {
  return approvedDomains.reduce(function(previous, domain) {
    return previous || domain.test(email);
  }, false);
}

module.exports.hasApprovedEmail = hasApprovedEmail;
