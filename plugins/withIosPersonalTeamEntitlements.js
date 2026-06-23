const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * Personal (free) Apple teams cannot use Push Notifications.
 * Keep App Groups for share-extension; drop aps-environment on local device builds.
 */
function withIosPersonalTeamEntitlements(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults['aps-environment'];
    return config;
  });
}

module.exports = withIosPersonalTeamEntitlements;
