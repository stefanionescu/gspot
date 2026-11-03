import { join } from 'node:path';
import { listPackagePins } from '#cli/tools/pins.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { NPM_TOOL_PROJECT } from '#cli/config/generation.ts';
import { mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { rootSettingSchemas } from '#cli/schemas/settings/file.ts';
import { downloadGrammar } from '#cli/tools/installers/grammars.ts';
import { SANDBOX_PACKAGES } from '#tests/config/setup/sandboxes.ts';
import { PACKAGE_JSON, GRAMMAR_NAMES } from '#cli/config/parsers.ts';
import { JSON_INDENT, BUN_LOCKFILE } from '#cli/config/tools/installers.ts';
import eslintPluginPackage from '#eslint-plugin-package' with { type: 'json' };

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
