import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { stringify } from '@decimalturn/toml-patch';
import { expect, spyOn, test } from 'bun:test';

import {
    checkOutputSchema,
    configurationOutputSchema,
    configurationsListOutputSchema,
    doctorOutputSchema,
    initOutputSchema,
    installOutputSchema,
    lintRuleOutputSchema,
    pathOutputSchema,
    scanOutputSchema,
    settingOutputSchema,
    settingsEditOutputSchema,
    settingsListOutputSchema,
} from '#cli/schemas/commands.ts';
import { runReportSchema } from '#cli/schemas/engine.ts';
import { compareText } from '#cli/system/text.ts';
import * as installers from '#cli/tools/installers/install.ts';
import { HOOKS_SETTINGS } from '#tests/config/setup/sandboxes.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildReportingCheck, buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { REPOSITORY_ROOT } from '#tests/setup/runner/run-folder.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';

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
    { commandArguments: ['check', '--json'], headings: ['## `gspot check`'], exitCode: 2, schema: runReportSchema },
    {
        commandArguments: ['add', 'bash', '--json'],
        headings: ['## Commands that change settings', '## Generated files'],
        schema: settingsEditOutputSchema,
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
    if (row.settings === false) commitAll(sandbox.path);
    else await applyGeneratedFiles(sandbox.path);
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

function readKeys(stdout: string): string[] {
    return Object.keys(JSON.parse(stdout) as object).toSorted(compareText);
}

test.each([
    { first: ['add', 'bash'], second: ['add', 'bash'] },
    { first: ['set', 'limits.max_function_lines', '30'], second: ['set', 'limits.max_function_lines', '30'] },
])('$first.0 prints the same keys after a change and after no change', async ({ first, second }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown'], { tables: '[limits]\nmax_function_lines = 20\n' }),
        'README.md': '# Example\n',
    });
    const changed = await runGspot(sandbox.path, [...first, '--json']);
    expect(changed.code, changed.stdout + changed.stderr).toBe(0);
    expect(settingsEditOutputSchema.parse(JSON.parse(changed.stdout)).changed).toBe(true);
    const unchanged = await runGspot(sandbox.path, [...second, '--json']);
    expect(unchanged.code, unchanged.stdout + unchanged.stderr).toBe(0);
    expect(settingsEditOutputSchema.parse(JSON.parse(unchanged.stdout))).toMatchObject({
        changed: false,
        written: [],
        updated: [],
        deleted: [],
        unchanged: [],
    });
});

test('check --staged prints the same keys with nothing staged, with a staged file, and in a plain run', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'README.md': '# Example\n',
    });
    commitAll(sandbox.path);
    const empty = await runGspot(sandbox.path, ['check', '--staged', '--only', 'gspot/generated-files', '--json']);
    expect(runReportSchema.parse(JSON.parse(empty.stdout))).toMatchObject({ comparison: null, fixes: null });
    await writeFile(join(sandbox.path, 'README.md'), '# Changed\n');
    runGitStep(sandbox.path, ['add', 'README.md']);
    const staged = await runGspot(sandbox.path, ['check', '--staged', '--only', 'gspot/generated-files', '--json']);
    expect(runReportSchema.parse(JSON.parse(staged.stdout)).comparison?.content).toBe('index');
    const working = await runGspot(sandbox.path, ['check', '--only', 'gspot/generated-files', '--json']);
    expect(readKeys(working.stdout)).toStrictEqual(readKeys(empty.stdout));
});

test('doctor prints the same keys of hooks and ci with and without them', async () => {
    await using off = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: '[hooks]\nenabled = false\n' }),
    });
    await using on = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            tables: `${HOOKS_SETTINGS}[ci]\nenabled = true\nprovider = "github"\n`,
        }),
    });
    await applyGeneratedFiles(on.path);
    runGitStep(on.path, ['config', 'core.hooksPath', '.gspot/hooks']);
    const hooksOff = await runGspot(off.path, ['doctor', '--json']);
    expect(doctorOutputSchema.parse(JSON.parse(hooksOff.stdout))).toMatchObject({
        ci: { enabled: false, provider: null, file: null },
        hooks: { ready: true, tool: null, lines: [] },
    });
    const hooksOn = await runGspot(on.path, ['doctor', '--json']);
    expect(doctorOutputSchema.parse(JSON.parse(hooksOn.stdout))).toMatchObject({
        ci: { enabled: true, provider: 'github' },
    });
});

test.each([
    { first: ['explain', 'bash/shellcheck'], second: ['explain', 'sandbox/own'] },
    { first: ['explain', 'limits.max_file_lines'], second: ['explain', 'format.quotes'] },
    { first: ['explain', './README.md'], second: ['explain', './image.png'] },
    { first: ['explain', 'data-files/yaml', 'documents'], second: ['explain', 'bash/shellcheck', 'SC2086'] },
])('$first and $second print the same keys', async ({ first, second }) => {
    const tables = stringify({
        command_check: [buildReportingCheck({ id: 'sandbox/own', paths: ['*'], stage: 'commit' })],
    });
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash', 'data-files'], { tables }),
        'README.md': '# Example\n',
        'image.png': '\0binary\n',
    });
    const left = await runGspot(sandbox.path, [...first, '--json']);
    expect(left.code, left.stdout + left.stderr).toBe(0);
    const right = await runGspot(sandbox.path, [...second, '--json']);
    expect(right.code, right.stdout + right.stderr).toBe(0);
    expect(readKeys(left.stdout)).toStrictEqual(readKeys(right.stdout));
});
