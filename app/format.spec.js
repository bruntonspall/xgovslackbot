/*jshint esversion:6*/
var assert = require('assert');
const format = require('./format');

describe('Formatting functions', function() {
  describe('uptime()', function() {
    it('should return for value 1', function() {
      assert.equal("1 second", format.uptime(1));
    });

    it('should return for value 2', function() {
      assert.equal("2 seconds", format.uptime(2));
    });

    it('should return for value 64', function() {
      assert.equal("1 minute, 4 seconds", format.uptime(64));
    });

    it('should return for value 152', function() {
      assert.equal("2 minutes, 32 seconds", format.uptime(152));
    });

    it('should return value 3802', function() {
      assert.equal("1 hour, 3 minutes, 22 seconds", format.uptime(3802));
    });

    it('should return for value 7267', function() {
      assert.equal("2 hours, 1 minute, 7 seconds", format.uptime(7267.0034));
    });
});
});
