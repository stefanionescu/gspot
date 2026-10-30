import { JSON_INDENT } from '#cli/config/text.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { listToolProjectPins } from '#cli/manifests/tools.ts';
import { SANDBOX_PACKAGES } from '#tests/config/setup/sandboxes.ts';
import { NPM_TOOL_PROJECT } from '#cli/config/generation/generate.ts';
import eslintPluginPackage from '#eslint-plugin-package' with { type: 'json' };

const pins = Object.entries(listToolProjectPins(readConfigurations().values().toArray()).npm).filter(
    ([name]) => name !== eslintPluginPackage.name,
);

process.stdout.write(
    `${JSON.stringify({ ...NPM_TOOL_PROJECT, devDependencies: { ...Object.fromEntries(pins), ...SANDBOX_PACKAGES } }, null, JSON_INDENT)}\n`,
);
