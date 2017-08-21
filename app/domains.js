function hasApprovedEmail(email) {
  if (email.match("^[^@]+@(.*\.gov|naturalengland\.org)\.uk$")) {    
    return true;
  }
  return false;
}

module.exports.hasApprovedEmail = hasApprovedEmail