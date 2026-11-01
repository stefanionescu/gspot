import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { listPackagePins } from '#cli/tools/pins.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { NPM_TOOL_PROJECT } from '#cli/config/generation.ts';
import { JSON_INDENT } from '#cli/config/tools/installers.ts';
import { SANDBOX_PACKAGES } from '#tests/config/setup/sandboxes.ts';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import eslintPluginPackage from '#eslint-plugin-package' with { type: 'json' };
import { GRAMMARS_FOLDER, GRAMMAR_RELEASES, GRAMMAR_FILE_EXTENSION } from '#cli/config/parsers.ts';

const pins = Object.entries(listPackagePins(readConfigurations().values().toArray()).npm).filter(
    ([name]) => name !== eslintPluginPackage.name,
);

const grammars = join(import.meta.dir, '../../../packages/cli', GRAMMARS_FOLDER);
mkdirSync(grammars, { recursive: true });
for (const [name, { sha256, url }] of Object.entries(GRAMMAR_RELEASES)) {
    const path = join(grammars, `${name}${GRAMMAR_FILE_EXTENSION}`);
    const saved = existsSync(path) ? readFileSync(path) : undefined;
    if (saved !== undefined && createHash('sha256').update(saved).digest('hex') === sha256) continue;
    const response = await fetch(url);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(bytes).digest('hex') !== sha256) throw new Error(`${url} fails its checksum.`);
    writeFileSync(path, bytes);
}

process.stdout.write(
    `${JSON.stringify({ ...NPM_TOOL_PROJECT, devDependencies: { ...Object.fromEntries(pins), ...SANDBOX_PACKAGES } }, null, JSON_INDENT)}\n`,
);
