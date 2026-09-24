// Usage: bun packages/cli/scripts/generate-schema.ts [--check]
// Generates the configuration schema for editor assistance.

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Command, CommanderError } from 'commander';
import packageManifest from '#package' with { type: 'json' };
import { policyJsonSchemaText } from '#cli/policy/json-schema.ts';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const here = dirname(fileURLToPath(new URL(import.meta.url)));
const root = join(here, '..', '..', '..');
const FILES: [string, () => string][] = [['packages/cli/schemas/gspot.schema.json', policyJsonSchemaText]];

function isCurrent(path: string, wanted: string): boolean {
    return existsSync(path) && readFileSync(path, 'utf8') === wanted;
}

try {
    const script = new Command('bun packages/cli/scripts/generate-schema.ts')
        .description('Generate the published JSON schemas')
        .version(packageManifest.version)
        .option('--check', 'Compare the generated files without writing')
        .allowExcessArguments(false)
        .showHelpAfterError()
        .addHelpText('after', '\nExample: bun packages/cli/scripts/generate-schema.ts --check')
        .exitOverride()
        .parse();
    const isCheck = script.getOptionValue('check') === true;
    const targets = FILES.map(([name, text]) => ({ relative: name, wanted: text() }));
    const stale = targets.filter((target) => !isCurrent(join(root, target.relative), target.wanted));
    if (isCheck && stale.length > 0) {
        const lines = stale.map((target) => `schema/generated  changed  ${target.relative}`);
        console.log([...lines, 'Run bun packages/cli/scripts/generate-schema.ts to rewrite the schema files.'].join('\n'));
        process.exitCode = 1;
    }
    if (!isCheck)
        for (const target of stale) {
            mkdirSync(dirname(join(root, target.relative)), { recursive: true });
            writeFileSync(join(root, target.relative), target.wanted);
        }
} catch (error) {
    if (!(error instanceof CommanderError)) throw error;
    process.exitCode = error.exitCode === 0 ? 0 : 2;
}
