import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { NPM_TOOL_PROJECT } from '#cli/config/generation.ts';
import { GRAMMAR_NAMES, PACKAGE_JSON } from '#cli/config/parsers.ts';
import { BUN_LOCKFILE, JSON_INDENT } from '#cli/config/tools/installers.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { rootSettingSchemas } from '#cli/schemas/settings/file.ts';
import { downloadGrammar } from '#cli/tools/installers/grammars.ts';
import { listPackagePins } from '#cli/tools/pins.ts';
import eslintPluginPackage from '#eslint-plugin-package' with { type: 'json' };
import { SANDBOX_PACKAGES } from '#tests/config/setup/sandboxes.ts';

const pins = Object.entries(listPackagePins(readConfigurations().values().toArray()).npm).filter(
    ([name]) => name !== eslintPluginPackage.name,
);
const folder = join(import.meta.dir, '../../../node_modules/.test-tools');

mkdirSync(folder, { recursive: true });
writeFileSync(
    join(folder, PACKAGE_JSON),
    `${JSON.stringify({ ...NPM_TOOL_PROJECT, devDependencies: { ...Object.fromEntries(pins), ...SANDBOX_PACKAGES } }, null, JSON_INDENT)}\n`,
);
copyFileSync(join(import.meta.dir, 'test-tools.lock'), join(folder, BUN_LOCKFILE));

const session = { settings: { tool_timeout_seconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined) } };
for (const grammar of GRAMMAR_NAMES) await downloadGrammar(grammar, session);
