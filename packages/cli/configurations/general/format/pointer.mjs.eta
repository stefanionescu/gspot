import { fileURLToPath } from 'node:url';
import config from './.gspot/config/prettier.json' with { type: 'json' };

const fromConfig = (pattern) => pattern.replace(/^(!?)\.\.\/\.\.\//u, '$1');
for (const override of config.overrides ?? []) {
    override.files = override.files.map(fromConfig);
    override.excludeFiles = override.excludeFiles.map(fromConfig);
}
if (config.plugins) {
    config.plugins = config.plugins.map((plugin) =>
        plugin.startsWith('.')
            ? fileURLToPath(new URL(plugin, new URL('./.gspot/config/prettier.json', import.meta.url)))
            : plugin,
    );
}
export default config;
