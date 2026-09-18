// Writes packages/cli/config/architecture-ids.ts: every check id the architecture names, and every preset page.
// Usage: bun packages/cli/scripts/check-ids.ts
import { join } from 'node:path';
import { CHECK_KINDS } from '#config/check-kinds.ts';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';

const root = new URL('../../..', import.meta.url).pathname;
const architecture = join(root, 'architecture');
const target = join(root, 'packages', 'cli', 'config', 'architecture-ids.ts');
const CHECK_ID = /`([a-z][a-z-]*)\/([a-z0-9][a-z0-9-]*)`/gu;
const kinds = new Set(CHECK_KINDS);

function walk(dir: string, out: string[]): string[] {
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path, out);
        else if (entry.endsWith('.md')) out.push(path);
    }
    return out;
}

function quotedLines(names: string[]): string {
    return names.map((value) => `    '${value}',`).join('\n');
}

const ids = new Set<string>();
const documents = walk(architecture, []);
for (const file of documents) {
    const matches = readFileSync(file, 'utf8').matchAll(CHECK_ID);
    for (const match of matches) {
        const [, kind = '', name = ''] = match;
        if (kinds.has(kind)) ids.add(`${kind}/${name}`);
    }
}
const presets = readdirSync(join(architecture, 'presets'))
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .map((name) => name.slice(0, -'.md'.length));
const checkIds = [...ids].toSorted((a, b) => a.localeCompare(b));
const presetIds = [...presets, 'rules', 'none'].toSorted((a, b) => a.localeCompare(b));
const text = [
    '// The check ids and preset pages the architecture names. Written by bun packages/cli/scripts/check-ids.ts; do not edit by hand.',
    '',
    '/** Every `kind/name` check id an architecture document cites. */',
    'export const CHECK_IDS = [',
    quotedLines(checkIds),
    '];',
    '',
    '/** Every preset page under architecture/presets, plus `rules` and `none`. */',
    'export const PRESET_IDS = [',
    quotedLines(presetIds),
    '];',
    '',
].join('\n');
writeFileSync(target, text);
process.stdout.write(
    `${String(checkIds.length)} check ids and ${String(presetIds.length)} preset ids written to ${target}\n`,
);
