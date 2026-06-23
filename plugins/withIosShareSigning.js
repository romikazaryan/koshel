const { withXcodeProject } = require('expo/config-plugins');

/** Automatic signing for main app and share extension (required for App Groups). */
function withIosShareSigning(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const bundleId = config.ios?.bundleIdentifier ?? 'com.anonymous.koshel';
    const shareBundleId = `${bundleId}.share-extension`;

    const buildConfigs = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(buildConfigs)) {
      const item = buildConfigs[key];
      if (!item?.buildSettings) continue;
      const id = item.buildSettings.PRODUCT_BUNDLE_IDENTIFIER;
      if (id === bundleId || id === shareBundleId) {
        item.buildSettings.CODE_SIGN_STYLE = 'Automatic';
      }
    }

    return config;
  });
}

module.exports = withIosShareSigning;
