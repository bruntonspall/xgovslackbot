/*jshint esversion:6*/

var approvedDomains = [
  'acas.org.uk',
  'bankofengland.co.uk',
  'bl.uk',
  'bmtdsl.co.uk',
  'cqc.org.uk',
  'ddc-mod.org',
  'digital.nhs.uk',
  'gov.scot',
  'gov.uk',
  'hee.nhs.uk',
  'highwaysengland.co.uk',
  'hmcts.net',
  'hs2.org.uk',
  'marinemanagement.org.uk',
  'mod.uk',
  'naturalengland.org.uk',
  'nhs.net',
  'nhsbt.nhs.uk',
  'nice.org.uk',
  'os.uk',
  'parliament.uk',
  'police.uk',
  'sepa.org.uk',
  'slc.co.uk',
  'stfc.ac.uk',
  'wiltonpark.org.uk'
]

function hasApprovedEmail(email) {
  return approvedDomains.reduce(function(previous, domain) {
    return previous || email.endsWith('.' + domain) || email.endsWith('@' + domain);
  }, false);
}

function approvedDomainsString() {
  return approvedDomains.slice().sort().join(', ');
}

module.exports.hasApprovedEmail = hasApprovedEmail;
module.exports.approvedDomainsString = approvedDomainsString;
