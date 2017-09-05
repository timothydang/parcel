const localRequire = require('../utils/localRequire');
const postcss = require('postcss');
const Config = require('../utils/config');

module.exports = async function (asset) {
  let config = await getConfig(asset);
  if (!config) {
    return;
  }

  await asset.parseIfNeeded();
  let res = await postcss(config.plugins).process(asset.ast, config);

  asset.ast = res.root;
  asset.contents = res.css;
  asset.astIsDirty = false;
}

async function getConfig(asset) {
  let config = asset.package.postcss || await Config.load(asset.name, ['.postcssrc', '.postcssrc.js', 'postcss.config.js']);
  if (!config) {
    return;
  }

  let plugins = [];

  // load plugins
  if (typeof config.plugins === 'object' && !Array.isArray(config.plugins)) {
    for (let key in config.plugins) {
      let plugin = localRequire(key, asset.name);
      let options = config.plugins[key];
      if (typeof options !== 'object') {
        options = {};
      }

      // Hack to get CSS modules class map JSON
      if (key === 'postcss-modules') {
        options.getJSON = (filename, json) => {
          asset.cssModules = json;
        };
      }

      if (Object.keys(options).length > 0) {
        plugin = plugin(options);
      }

      plugin = plugin.postcss || plugin.default || plugin;
      if (!(typeof plugin === 'object' && Array.isArray(plugin.plugins) || typeof plugin === 'function')) {
        throw new TypeError('Invalid PostCSS Plugin found: ' + '[' + key + ']')
      }

      plugins.push(plugin);
    }
  }

  config.plugins = plugins;
  config.from = asset.name;
  config.to = asset.name;
  return config;
}