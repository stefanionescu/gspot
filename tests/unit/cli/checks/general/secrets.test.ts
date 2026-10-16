import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { textContaining } from '#tests/setup/matchers.ts';
import { CHECK_IMPLEMENTATIONS } from '#cli/checks/implementations.ts';
import { checkFindings, buildCheckInput } from '#tests/setup/check-input.ts';

import {
    READER_FILES,
    READER_TABLES,
    READER_EXAMPLE,
    READER_FINDINGS,
    NESTED_ENV_FILES,
    ENV_ACCESSOR_FILES,
    SCOPE_READER_FIXES,
    SCOPE_READER_FILES,
    SCOPE_READER_TABLES,
    ENV_ACCESSOR_EXAMPLE,
} from '#tests/config/secrets.ts';

test('a nested scope uses the default example environment file names', async () => {
    await using sandbox = await testdir({
        ...NESTED_ENV_FILES,
        'gspot.toml': settingsText(['secrets'], {
            level: 'all',
            tables: '[[scope]]\npath = "app"\nconfigurations = ["secrets"]\n',
        }),
    });
    expect(await checkFindings(sandbox.path, 'secrets/env-examples', { scope: 'app' })).toMatchObject([
        { file: 'app/source.ts', rule: 'missing-key', message: textContaining('MISSING') },
    ]);
    await Bun.write(join(sandbox.path, 'app/.env.example'), 'KNOWN=example\nMISSING=example\n');
    expect(await checkFindings(sandbox.path, 'secrets/env-examples', { scope: 'app' })).toStrictEqual([]);
});

test('keys read through Bun.env and custom reader functions are reported until the example file lists them', async () => {
    await using sandbox = await testdir();
    const settings = settingsText([], { tables: READER_TABLES });
    await createFileTree(sandbox.path, { ...READER_FILES, 'gspot.toml': settings });
    const command = ['check', '--only', 'secrets/env-examples', '--json'];
    const failed = await checkReport(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const report = failed.report;
    expect(report.checks).toMatchObject([
        { check: 'secrets/env-examples', status: 'failed', findings: READER_FINDINGS },
    ]);
    await Bun.write(join(sandbox.path, 'config/example.env'), READER_EXAMPLE);
    const corrected = await checkReport(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check: 'secrets/env-examples', status: 'passed', findings: [] }]);
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(settings);
});

test('each scope checks its own example env files and reader functions', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...SCOPE_READER_FILES,
        'gspot.toml': settingsText([], { tables: SCOPE_READER_TABLES }),
    });
    const command = ['check', '--only', 'secrets/env-examples', '--json'];
    const failed = await checkReport(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const report = failed.report;
    expect(report.checks).toMatchObject([
        { scope: '', status: 'failed', findings: [{ file: 'source.ts', line: 1, rule: 'missing-key' }] },
        { scope: 'app', status: 'failed', findings: [{ file: 'app/source.ts', line: 1, rule: 'missing-key' }] },
        {
            scope: 'sibling',
            status: 'failed',
            findings: [{ file: 'sibling/source.ts', line: 1, rule: 'missing-key' }],
        },
    ]);
    await createFileTree(sandbox.path, SCOPE_READER_FIXES);
    const corrected = await checkReport(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks.map((check) => check.status)).toEqual(['passed', 'passed', 'passed']);
});

test('Bun.env reads are checked with no reader functions declared', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText([]),
        '.env.example': 'KNOWN=example\n',
        'source.ts': 'Bun.env.KNOWN; Bun.env["MISSING"];\nconfig.$env("UNDECLARED");\n',
    });
    const checked = await checkReport(sandbox.path, ['check', '--only', 'secrets/env-examples', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect(checked.report.checks).toMatchObject([
        {
            check: 'secrets/env-examples',
            status: 'failed',
            findings: [{ file: 'source.ts', line: 1, rule: 'missing-key' }],
        },
    ]);
});

test('a scope with env reads and no example env file is skipped with a note', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.env.example': 'KNOWN=value\n',
        'app/source.ts': 'process.env.MISSING;\n',
    });
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        settingsText(['files'], {
            level: 'all',
            tables: '[[scope]]\npath = "app"\nconfigurations = ["files"]\n',
        }),
    );
    const input = buildCheckInput(await openSession(sandbox.path), 'secrets/env-examples', {
        scope: 'app',
        paths: ['.env.example', 'app/source.ts'],
    });
    expect(CHECK_IMPLEMENTATIONS['secrets/env-examples'].check(input)).rejects.toThrow('secrets.env_examples');
    const checked = await checkReport(sandbox.path, [
        'check',
        'app/source.ts',
        '--only',
        'secrets/env-examples',
        '--json',
    ]);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(checked.report.checks).toMatchObject([
        {
            check: 'secrets/env-examples',
            scope: 'app',
            status: 'skipped',
            findings: [],
            note: textContaining('secrets.env_examples'),
        },
    ]);
});

test('import.meta.env and Deno.env reads in component and module files need example keys', async () => {
    await using sandbox = await testdir();
    const settings = settingsText(['files'], { level: 'all' });
    const sources = ENV_ACCESSOR_FILES;
    await createFileTree(sandbox.path, { 'gspot.toml': settings, '.env.example': 'KNOWN=example\n', ...sources });
    const rejected = await checkFindings(sandbox.path, 'secrets/env-examples');
    expect(rejected.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'app.astro', line: 2, rule: 'missing-key' },
        { file: 'app.svelte', line: 1, rule: 'missing-key' },
        { file: 'app.vue', line: 1, rule: 'missing-key' },
        { file: 'common.cts', line: 1, rule: 'missing-key' },
        { file: 'legacy.cjs', line: 1, rule: 'missing-key' },
        { file: 'module.mts', line: 1, rule: 'missing-key' },
        { file: 'worker.ts', line: 1, rule: 'missing-key' },
    ]);
    await Bun.write(join(sandbox.path, '.env.example'), ENV_ACCESSOR_EXAMPLE);
    expect(await checkFindings(sandbox.path, 'secrets/env-examples')).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
    for (const [path, text] of Object.entries(sources))
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(text);
});
