/*jshint esversion:6*/
var assert = require('assert');
const domains = require('./domains');

describe('Domain testing functions', function() {
  describe('hasApprovedEmail()', function() {
    it('should return true for government emails', function() {
        // Note these are fictional email addresses
        var addresses = [
            "foo@bar.gov.uk",
            "foo@baz.bar.bop.gov.uk",
            "x@foobar.gov.uk",
            "foo@naturalengland.org.uk"
        ];
        addresses.forEach(function(email) {
            assert.ok(domains.hasApprovedEmail(email), email);
        });
    });

    it('should return false for non uk government emails', function() {
        // Note these are fictional email addresses
        var addresses = [
            "foo@bar.gov",
            "foo@baz.bar.bop.uk",
            "x@foobar.com",
            "foo@notreallynaturalengland.org.uk"
        ];
        addresses.forEach(function(email) {
            assert.ok(!domains.hasApprovedEmail(email), email);
        });
    });
  });

  describe('approvedDomainsString()', function() {
    it('should be a comma separated list', function() {
      var domainsString = domains.approvedDomainsString();
      assert.ok(domainsString.indexOf(', ') > 0, domainsString);
    });
  });
});
