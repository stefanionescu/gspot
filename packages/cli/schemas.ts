// Writes the two published JSON schemas from their zod sources, under schema/ and under the manual's public folder.
// Usage: bun packages/cli/schemas.ts [--check]
import { dirname, join } from 'node:path';
import { recordJsonSchemaText } from '#cli/run/record/schema.ts';
import { policyJsonSchemaText } from '#cli/policy/json-schema.ts';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const here = dirname(new URL(import.meta.url).pathname);
const root = join(here, '..', '..');
const FOLDERS = ['schema', join('docs', 'public', 'schema')];
const FILES: [string, () => string][] = [
    ['gspot.schema.json', policyJsonSchemaText],
    ['run-record.schema.json', recordJsonSchemaText],
];

function isCurrent(path: string, wanted: string): boolean {
    return existsSync(path) && readFileSync(path, 'utf8') === wanted;
}

const isCheck = process.argv.includes('--check');
const targets = FOLDERS.flatMap((folder) =>
    FILES.map(([name, text]) => ({ relative: join(folder, name), wanted: text() })),
);
const stale = targets.filter((target) => !isCurrent(join(root, target.relative), target.wanted));
if (isCheck && stale.length > 0) {
    const lines = stale.map((target) => `schema/generated  changed  ${target.relative}`);
    console.log([...lines, 'Run bun packages/cli/schemas.ts to rewrite the schema files.'].join('\n'));
    process.exitCode = 1;
}
if (!isCheck)
    for (const target of stale) {
        mkdirSync(dirname(join(root, target.relative)), { recursive: true });
        writeFileSync(join(root, target.relative), target.wanted);
    }
