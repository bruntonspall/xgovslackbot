/*jshint esversion:6*/

/*
Adding an entry into the `approvedDomains` array below works as a postfix so any email domain ending with a postfix can then be invited through the bot.

For example, the main entry below is `gov.uk` allowing @agency.gov.uk, @department.gov.uk or @something.executiveagency.gov.uk to be invite-able through the bot. Another example would be `police.uk`, which allows @force1.police.uk and @force2.police.uk.
*/

var approvedDomains = [
  'gov.uk',
  'gov.scot',
  'acas.org.uk',
  'bankofengland.co.uk',
  'biglotteryfund.org.uk',
  'bl.uk',
  'bmtdsl.co.uk',
  'caa.co.uk',
  'cqc.org.uk',
  'ddc-mod.org',
  'digital.nhs.uk',
  'electoralcommission.org.uk',
  'hee.nhs.uk',
  'highwaysengland.co.uk',
  'hlf.org.uk',
  'hmcts.net',
  'hs2.org.uk',
  'jncc.gov.uk',
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
