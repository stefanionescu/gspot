import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, spyOn, test } from 'bun:test';

import {
    changedEditOutputSchema,
    checkOutputSchema,
    checkReportSchema,
    configurationOutputSchema,
    configurationsListOutputSchema,
    doctorOutputSchema,
    initOutputSchema,
    installOutputSchema,
    lintRuleOutputSchema,
    pathOutputSchema,
    scanOutputSchema,
    settingOutputSchema,
    settingsListOutputSchema,
    unchangedEditOutputSchema,
} from '#cli/schemas/commands.ts';
import * as installers from '#cli/tools/installers/install.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { REPOSITORY_ROOT } from '#tests/setup/runner/run-folder.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

const PAGE = await readFile(join(REPOSITORY_ROOT, 'docs/src/content/docs/reference/json-output.mdx'), 'utf8');

function readFields(heading: string): { every: string[]; required: string[] } {
    const section = PAGE.slice(PAGE.indexOf(`\n${heading}\n`) + heading.length + 2).split(/^#{2,3} /mu, 1)[0] ?? '';
    // A section's own fields sit in its "Field | Meaning" table; a "Field of `name`" table describes a nested object.
    const lines = section.split('\n');
    const start = lines.findIndex((line) => /^\| Field +\| Meaning/u.test(line));
    const end = lines.findIndex((line, index) => index > start && !line.startsWith('|'));
    const rows = lines
        .slice(start, end === -1 ? undefined : end)
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
    { commandArguments: ['scan', '--json'], headings: ['## `gspot scan`'], settings: false, schema: scanOutputSchema },
    {
        commandArguments: ['init', '--json'],
        headings: ['## `gspot init`', '## Generated files'],
        settings: false,
        schema: initOutputSchema,
    },
    {
        commandArguments: ['install', '--json'],
        headings: ['## `gspot install`', '## Generated files'],
        schema: installOutputSchema,
    },
    { commandArguments: ['check', '--json'], headings: ['## `gspot check`'], exitCode: 2, schema: checkReportSchema },
    {
        commandArguments: ['add', 'bash', '--json'],
        headings: ['## Commands that change settings', '## Generated files'],
        schema: changedEditOutputSchema,
    },
    {
        commandArguments: ['add', 'markdown', '--json'],
        headings: ['## Commands that change settings'],
        schema: unchangedEditOutputSchema,
    },
    { commandArguments: ['list', '--json'], headings: ['## `gspot list`'], schema: configurationsListOutputSchema },
    {
        commandArguments: ['list', 'settings', '--json'],
        headings: ['## `gspot list settings`'],
        schema: settingsListOutputSchema,
    },
    {
        commandArguments: ['doctor', '--json'],
        headings: ['## `gspot doctor`'],
        exitCode: 1,
        schema: doctorOutputSchema,
    },
    {
        commandArguments: ['explain', 'markdown/markdownlint', '--json'],
        headings: ['### `check`'],
        kind: true,
        schema: checkOutputSchema,
    },
    {
        commandArguments: ['explain', 'data-files/yaml', 'documents', '--json'],
        headings: ['### `lint-rule`'],
        kind: true,
        schema: lintRuleOutputSchema,
    },
    {
        commandArguments: ['explain', 'markdown', '--json'],
        headings: ['### `configuration`'],
        kind: true,
        schema: configurationOutputSchema,
    },
    {
        commandArguments: ['explain', 'limits.max_file_lines', '--json'],
        headings: ['### `setting`'],
        kind: true,
        schema: settingOutputSchema,
    },
    {
        commandArguments: ['explain', './README.md', '--json'],
        headings: ['### `path`'],
        kind: true,
        schema: pathOutputSchema,
    },
])('$commandArguments prints the fields of its section of json-output.mdx, as its schema describes', async (row) => {
    await using sandbox = await createGitSandbox({
        ...(row.settings !== false && { 'gspot.toml': buildSandboxSettings(['markdown', 'data-files']) }),
        'README.md': '# Example\n',
    });
    using _install = spyOn(installers, 'installTools').mockResolvedValue({
        installed: ['installed 1 npm tool'],
        missing: [],
        notes: [],
        steps: [],
    });
    if (row.settings !== false) await applyGeneratedFiles(sandbox.path);
    const result = await runGspot(sandbox.path, row.commandArguments);
    expect(result.code, result.stdout + result.stderr).toBe(row.exitCode ?? 0);
    const keys = Object.keys(row.schema.parse(JSON.parse(result.stdout))).filter(
        (key) => !['version', 'exitCode', 'notes', ...(row.kind === true ? ['kind', 'subject'] : [])].includes(key),
    );
    const fields = row.headings.map((heading) => readFields(heading));
    const every = new Set(fields.flatMap((field) => field.every));
    const required = fields.flatMap((field) => field.required);
    expect(keys.filter((key) => !every.has(key))).toStrictEqual([]);
    expect(required.filter((field) => !keys.includes(field))).toStrictEqual([]);
});
