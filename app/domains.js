function hasApprovedEmail(email) {
  if (email.match(".*\.gov\.uk$")) {
    return true;
  }
  return false;
}

module.exports.hasApprovedEmail = hasApprovedEmail