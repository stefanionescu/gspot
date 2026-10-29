import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runChecks } from '#cli/commands/check/run.ts';
import { openSession } from '#cli/planning/session.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { NO_FILES_MESSAGE } from '#cli/config/commands/check/results.ts';

import {
    ENV_ACCESSOR_FILES,
    ENV_ACCESSOR_EXAMPLE,
    READER_PROJECT_FILES,
    ENVIRONMENT_TEXT_CASES,
    BUN_ENVIRONMENT_RESULTS,
    ENVIRONMENT_SCOPE_RESULTS,
    SCOPE_FUNCTION_CORRECTIONS,
    SCOPE_READER_PROJECT_FILES,
    SCOPE_READER_PROJECT_TABLES,
    ENVIRONMENT_FUNCTION_EXAMPLE,
    ENVIRONMENT_FUNCTION_FINDINGS,
    COMPONENT_ENVIRONMENT_FINDINGS,
} from '#tests/config/checks/general/secrets.ts';

test('a nested scope uses the default example environment file names', async () => {
    await using sandbox = await testdir({
        'app/.env.example': 'KNOWN=example\n',
        'app/source.ts': 'process.env.KNOWN; process.env.MISSING;\n',
        'gspot.toml': buildSandboxSettings(['secrets'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['secrets'] }],
        }),
    });
    expect(await runSandboxCheck(sandbox.path, 'secrets/env-examples', { scope: 'app' })).toMatchObject([
        {
            file: 'app/source.ts',
            rule: 'missing-key',
            message: 'MISSING is read here and appears in no example environment file.',
        },
    ]);
    await createFileTree(sandbox.path, { 'app/.env.example': 'KNOWN=example\nMISSING=example\n' });
    expect(await runSandboxCheck(sandbox.path, 'secrets/env-examples', { scope: 'app' })).toStrictEqual([]);
});

test('keys read through Bun.env and environment functions are reported until the example file lists them', async () => {
    const options = buildRunOptions({ only: ['secrets/env-examples'] });
    await using sandbox = await testdir({
        ...READER_PROJECT_FILES,
        'gspot.toml': buildSandboxSettings([], {
            tables: `[secrets]
env_examples = ["example.env"]
environment_functions = ["config.$env", "$readEnv", "read_env"]
`,
        }),
    });

    const failed = await runChecks(await openSession(sandbox.path), options);

    expect(failed.report.checks).toMatchObject([
        { check: 'secrets/env-examples', status: 'failed', findings: ENVIRONMENT_FUNCTION_FINDINGS },
    ]);
    await createFileTree(sandbox.path, { 'config/example.env': ENVIRONMENT_FUNCTION_EXAMPLE });
    const corrected = await runChecks(await openSession(sandbox.path), options);

    expect(corrected.report.checks).toMatchObject([{ check: 'secrets/env-examples', status: 'passed', findings: [] }]);
});

test('each scope checks its own example env files and environment functions', async () => {
    const options = buildRunOptions({ only: ['secrets/env-examples'] });
    await using sandbox = await testdir({
        ...SCOPE_READER_PROJECT_FILES,
        'gspot.toml': buildSandboxSettings([], { tables: SCOPE_READER_PROJECT_TABLES }),
    });

    const failed = await runChecks(await openSession(sandbox.path), options);

    expect(failed.report.checks).toMatchObject([...ENVIRONMENT_SCOPE_RESULTS]);
    await createFileTree(sandbox.path, SCOPE_FUNCTION_CORRECTIONS);
    const corrected = await runChecks(await openSession(sandbox.path), options);

    expect(corrected.report.checks.map((check) => check.status)).toStrictEqual(['passed', 'passed', 'passed']);
});

test('Bun.env reads are checked with no environment functions declared', async () => {
    const options = buildRunOptions({ only: ['secrets/env-examples'] });
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([]),
        '.env.example': 'KNOWN=example\n',
        'source.ts': 'Bun.env.KNOWN; Bun.env["MISSING"];\nconfig.$env("UNDECLARED");\n',
    });

    const checked = await runChecks(await openSession(sandbox.path), options);

    expect(checked.report.checks).toMatchObject([...BUN_ENVIRONMENT_RESULTS]);
});

test('a scope with env reads and no example env file is skipped with a note', async () => {
    await using sandbox = await testdir({
        '.env.example': 'KNOWN=value\n',
        'app/source.ts': 'process.env.MISSING;\n',
        'gspot.toml': buildSandboxSettings(['data-files'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['data-files'] }],
        }),
    });
    const checked = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['secrets/env-examples'], paths: ['app/source.ts'] }),
    );

    expect(checked.report.checks).toMatchObject([
        { check: 'secrets/env-examples', scope: '', status: 'skipped', findings: [], note: NO_FILES_MESSAGE },
        {
            check: 'secrets/env-examples',
            scope: 'app',
            status: 'skipped',
            findings: [],
            note: 'No example environment file exists in app. List the example environment files in secrets.env_examples.',
        },
    ]);
});

test('import.meta.env and Deno.env reads in component and module files need example keys', async () => {
    const settings = buildSandboxSettings(['data-files'], { level: 'all' });
    await using sandbox = await testdir({
        'gspot.toml': settings,
        '.env.example': 'KNOWN=example\n',
        ...ENV_ACCESSOR_FILES,
    });
    const rejected = await runSandboxCheck(sandbox.path, 'secrets/env-examples');
    expect(rejected.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        ...COMPONENT_ENVIRONMENT_FINDINGS,
    ]);
    await createFileTree(sandbox.path, { '.env.example': ENV_ACCESSOR_EXAMPLE });
    expect(await runSandboxCheck(sandbox.path, 'secrets/env-examples')).toStrictEqual([]);
});

test.each([...ENVIRONMENT_TEXT_CASES])('$name', async ({ files, changed, findings: expected }) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['secrets']),
        ...files,
    });
    expect(await runSandboxCheck(sandbox.path, 'secrets/env-examples')).toStrictEqual([]);
    await createFileTree(sandbox.path, changed);
    const findings = await runSandboxCheck(sandbox.path, 'secrets/env-examples');
    expect(findings.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual([...expected]);
});
