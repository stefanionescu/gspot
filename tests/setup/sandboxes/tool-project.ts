import { JSON_INDENT } from '#cli/config/text.ts';
import { listToolProjectPins } from '#cli/configurations/tools.ts';
import { SANDBOX_PACKAGES } from '#tests/config/setup/sandboxes.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { NPM_TOOL_PROJECT } from '#cli/config/generation/tool-projects.ts';
import eslintPluginPackage from '#eslint-plugin-package' with { type: 'json' };

const pins = Object.entries(listToolProjectPins(readConfigurations().values().toArray()).npm).filter(
    ([name]) => name !== eslintPluginPackage.name,
);

process.stdout.write(
    `${JSON.stringify({ ...NPM_TOOL_PROJECT, devDependencies: { ...Object.fromEntries(pins), ...SANDBOX_PACKAGES } }, null, JSON_INDENT)}\n`,
);
