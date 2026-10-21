import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { runChecks } from '#cli/commands/check/run.ts';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';

import {
    READER_EXAMPLE,
    READER_PROJECT,
    READER_FINDINGS,
    NESTED_ENV_FILES,
    ENV_ACCESSOR_FILES,
    SCOPE_READER_FIXES,
    ENV_ACCESSOR_EXAMPLE,
    SCOPE_READER_PROJECT,
    ENVIRONMENT_CHECK_OPTIONS,
} from '#tests/data/checks/secrets.ts';

test('a nested scope uses the default example environment file names', async () => {
    await using sandbox = await testdir({
        ...NESTED_ENV_FILES,
        'gspot.toml': buildSandboxSettings(['secrets'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['secrets'] }],
        }),
    });
    expect(await checkFindings(sandbox.path, 'secrets/env-examples', { scope: 'app' })).toMatchObject([
        { file: 'app/source.ts', rule: 'missing-key', message: expect.stringContaining('MISSING') as string },
    ]);
    await createFileTree(sandbox.path, { 'app/.env.example': 'KNOWN=example\nMISSING=example\n' });
    expect(await checkFindings(sandbox.path, 'secrets/env-examples', { scope: 'app' })).toStrictEqual([]);
});

test('keys read through Bun.env and custom environment functions are reported until the example file lists them', async () => {
    await using sandbox = await testdir(READER_PROJECT);

    const failed = await runChecks(await openSession(sandbox.path), buildRunOptions(ENVIRONMENT_CHECK_OPTIONS));

    const report = failed.report;
    expect(report.checks).toMatchObject([
        { check: 'secrets/env-examples', status: 'failed', findings: READER_FINDINGS },
    ]);
    await createFileTree(sandbox.path, { 'config/example.env': READER_EXAMPLE });
    const corrected = await runChecks(await openSession(sandbox.path), buildRunOptions(ENVIRONMENT_CHECK_OPTIONS));

    expect(corrected.report.checks).toMatchObject([{ check: 'secrets/env-examples', status: 'passed', findings: [] }]);
});

test('each scope checks its own example env files and environment functions', async () => {
    await using sandbox = await testdir(SCOPE_READER_PROJECT);

    const failed = await runChecks(await openSession(sandbox.path), buildRunOptions(ENVIRONMENT_CHECK_OPTIONS));

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
    const corrected = await runChecks(await openSession(sandbox.path), buildRunOptions(ENVIRONMENT_CHECK_OPTIONS));

    expect(corrected.report.checks.map((check) => check.status)).toEqual(['passed', 'passed', 'passed']);
});

test('Bun.env reads are checked with no environment functions declared', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([]),
        '.env.example': 'KNOWN=example\n',
        'source.ts': 'Bun.env.KNOWN; Bun.env["MISSING"];\nconfig.$env("UNDECLARED");\n',
    });

    const checked = await runChecks(await openSession(sandbox.path), buildRunOptions(ENVIRONMENT_CHECK_OPTIONS));

    expect(checked.report.checks).toMatchObject([
        {
            check: 'secrets/env-examples',
            status: 'failed',
            findings: [{ file: 'source.ts', line: 1, rule: 'missing-key' }],
        },
    ]);
});

test('a scope with env reads and no example env file is skipped with a note', async () => {
    await using sandbox = await testdir({
        '.env.example': 'KNOWN=value\n',
        'app/source.ts': 'process.env.MISSING;\n',
        'gspot.toml': buildSandboxSettings(['files'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['files'] }],
        }),
    });
    const checked = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['secrets/env-examples'], paths: ['app/source.ts'] }),
    );

    expect(checked.report.checks).toMatchObject([
        { check: 'secrets/env-examples', scope: '', status: 'skipped', findings: [], note: 'No matching files.' },
        {
            check: 'secrets/env-examples',
            scope: 'app',
            status: 'skipped',
            findings: [],
            note: expect.stringContaining('secrets.env_examples') as string,
        },
    ]);
});

test('import.meta.env and Deno.env reads in component and module files need example keys', async () => {
    const settings = buildSandboxSettings(['files'], { level: 'all' });
    const sources = ENV_ACCESSOR_FILES;
    await using sandbox = await testdir({ 'gspot.toml': settings, '.env.example': 'KNOWN=example\n', ...sources });
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
    await createFileTree(sandbox.path, { '.env.example': ENV_ACCESSOR_EXAMPLE });
    expect(await checkFindings(sandbox.path, 'secrets/env-examples')).toStrictEqual([]);
});
