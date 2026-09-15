// The transform the kit's Jest tests run on — the same as vuco's apps/mobile: babel-preset-expo with
// NativeWind's JSX import source. Not shipped: a consuming app bundles kit source with its own config.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
