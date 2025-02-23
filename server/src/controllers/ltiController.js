const getRole = (roles) => {
  const regex =
    /^http:\/\/purl\.imsglobal\.org\/vocab\/lis\/v2\/membership#(\w+)\.?$/;
  const membershipRoles = roles
    .map((url) => {
      const match = url.match(regex);
      return match ? match[1] : null; // Extract role or return null
    })
    .filter(Boolean); // Remove null values

  return membershipRoles[0];
};

module.exports = {
  getRole,
};
