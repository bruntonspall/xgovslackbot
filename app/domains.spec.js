var assert = require('assert');
const domains = require('./domains');

describe('Domain testing functions', function() {
  describe('hasApprovedEmail()', function() {
    it('should return true for government emails', function() {
        // Note these are fictional email addresses
        var addresses = [
            "foo@bar.gov.uk",
            "foo@baz.bar.bop.gov.uk",
            "x@foobar.gov.uk"
        ]
        addresses.forEach(function(email) {
            assert.equal(true, domains.hasApprovedEmail(email));
        })
    });

    it('should return false for non uk government emails', function() {
        // Note these are fictional email addresses
        var addresses = [
            "foo@bar.gov",
            "foo@baz.bar.bop.uk",
            "x@foobar.com"
        ]
        addresses.forEach(function(email) {
            assert.equal(false, domains.hasApprovedEmail(email));
        })
    });
});
});