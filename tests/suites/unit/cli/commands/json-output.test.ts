import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { runGspot } from '#tests/setup/cli/commands.ts';
import * as installers from '#cli/tools/installers/install.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { REPOSITORY_ROOT } from '#tests/setup/runner/run-folder.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

const PAGE = await readFile(join(REPOSITORY_ROOT, 'docs/src/content/docs/reference/json-output.mdx'), 'utf8');

function readFields(heading: string): { every: string[]; required: string[] } {
    const section = PAGE.slice(PAGE.indexOf(`\n${heading}\n`) + heading.length + 2).split(/^#{2,3} /mu, 1)[0] ?? '';
    const rows = section
        .split('\n')
        .map((line) => /^\| `(?<field>[A-Za-z]+)` +\| (?<meaning>.*) \|$/u.exec(line)?.groups)
        .filter((row) => row !== undefined);
    return {
        every: rows.map((row) => row['field'] as string),
        required: rows
            .filter((row) => row['meaning']?.startsWith('When present') !== true)
            .map((row) => row['field'] as string),
    };
}

test.each([
    { commandArguments: ['init', '--json'], headings: ['## `gspot init`', '## Generated files'], settings: false },
    { commandArguments: ['apply', '--json'], headings: ['## Generated files'] },
    { commandArguments: ['install', '--json'], headings: ['## `gspot install`'] },
    { commandArguments: ['check', '--json'], headings: ['## `gspot check`'], exitCode: 2 },
    {
        commandArguments: ['add', 'bash', '--json'],
        headings: ['## Commands that change settings', '## Generated files'],
    },
    { commandArguments: ['add', 'markdown', '--json'], headings: ['## Commands that change settings'] },
    { commandArguments: ['list', '--json'], headings: ['## `gspot list`'] },
    { commandArguments: ['list', 'settings', '--json'], headings: ['## `gspot list settings`'] },
    { commandArguments: ['doctor', '--json'], headings: ['## `gspot doctor`'], exitCode: 1 },
    { commandArguments: ['explain', 'markdown/markdownlint', '--json'], headings: ['### `check`'], kind: true },
    {
        commandArguments: ['explain', 'data-files/yaml', 'documents', '--json'],
        headings: ['### `lint-rule`'],
        kind: true,
    },
    { commandArguments: ['explain', 'markdown', '--json'], headings: ['### `configuration`'], kind: true },
    { commandArguments: ['explain', 'limits.max_file_lines', '--json'], headings: ['### `setting`'], kind: true },
    { commandArguments: ['explain', './README.md', '--json'], headings: ['### `path`'], kind: true },
])('$commandArguments prints the fields of its section of json-output.mdx', async (row) => {
    await using sandbox = await createGitSandbox({
        ...(row.settings === false ? {} : { 'gspot.toml': buildSandboxSettings(['markdown', 'data-files']) }),
        'README.md': '# Example\n',
    });
    using _install = spyOn(installers, 'installTools').mockResolvedValue({
        installed: ['installed 1 npm tool'],
        missing: [],
        notes: [],
        steps: [],
    });
    if (row.settings !== false) await runGspot(sandbox.path, ['apply']);
    const result = await runGspot(sandbox.path, row.commandArguments);
    expect(result.code, result.stdout + result.stderr).toBe(row.exitCode ?? 0);
    const keys = Object.keys(JSON.parse(result.stdout) as object).filter(
        (key) => !['version', 'exitCode', 'notes', ...(row.kind === true ? ['kind', 'subject'] : [])].includes(key),
    );
    const fields = row.headings.map((heading) => readFields(heading));
    const every = new Set(fields.flatMap((field) => field.every));
    const required = fields.flatMap((field) => field.required);
    expect(keys.filter((key) => !every.has(key))).toStrictEqual([]);
    expect(required.filter((field) => !keys.includes(field))).toStrictEqual([]);
});
