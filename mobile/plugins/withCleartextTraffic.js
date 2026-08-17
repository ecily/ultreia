const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withCleartextTraffic(config) {
  return withAndroidManifest(config, (modConfig) => {
    const application = modConfig.modResults.manifest.application?.[0];
    if (!application) return modConfig;

    if (config.extra?.mode === 'production') delete application.$['android:usesCleartextTraffic'];
    else application.$['android:usesCleartextTraffic'] = 'true';
    return modConfig;
  });
};
