import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import {
    COMPONENT_ENVIRONMENT_FINDINGS,
    ENV_ACCESSOR_EXAMPLE,
    ENV_ACCESSOR_FILES,
    ENVIRONMENT_FUNCTION_EXAMPLE,
    ENVIRONMENT_FUNCTION_FINDINGS,
    ENVIRONMENT_SCOPE_RESULTS,
    ENVIRONMENT_TEXT_CASES,
    READER_PROJECT_FILES,
    SCOPE_FUNCTION_CORRECTIONS,
    SCOPE_READER_PROJECT_FILES,
    SCOPE_READER_PROJECT_TABLES,
} from '#tests/config/configurations/secrets.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('a nested scope uses the default example environment file names', async () => {
    await using sandbox = await createGitSandbox({
        'app/.env.example': 'KNOWN=example\n',
        'app/source.ts': 'process.env.KNOWN; process.env.MISSING;\n',
        'gspot.toml': buildSandboxSettings(['secrets'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['secrets'] }],
        }),
    });
    expect(await runSandboxCheck(sandbox.path, 'secrets/environment-examples', { scope: 'app' })).toMatchObject([
        {
            file: 'app/source.ts',
            rule: 'missing-key',
            message: expect.stringContaining('MISSING') as string,
        },
    ]);
    await createFileTree(sandbox.path, { 'app/.env.example': 'KNOWN=example\nMISSING=example\n' });
    expect(await runSandboxCheck(sandbox.path, 'secrets/environment-examples', { scope: 'app' })).toStrictEqual([]);
});

test('keys read through Bun.env and environment functions are reported until the example file lists them', async () => {
    const options = buildRunOptions({ only: ['secrets/environment-examples'] });
    await using sandbox = await createGitSandbox({
        ...READER_PROJECT_FILES,
        'gspot.toml': buildSandboxSettings([], {
            tables: `[secrets]
environment_examples = ["example.env"]
environment_functions = ["config.$env", "$readEnv", "read_env"]
`,
        }),
    });

    const failed = await runChecks(await openSession(sandbox.path), options);

    expect(failed.report.checks).toMatchObject([
        { check: 'secrets/environment-examples', status: 'failed', findings: ENVIRONMENT_FUNCTION_FINDINGS },
    ]);
    await createFileTree(sandbox.path, { 'config/example.env': ENVIRONMENT_FUNCTION_EXAMPLE });
    const corrected = await runChecks(await openSession(sandbox.path), options);

    expect(corrected.report.checks).toMatchObject([
        { check: 'secrets/environment-examples', status: 'passed', findings: [] },
    ]);
});

test('each scope checks its own example env files and environment functions', async () => {
    const options = buildRunOptions({ only: ['secrets/environment-examples'] });
    await using sandbox = await createGitSandbox({
        ...SCOPE_READER_PROJECT_FILES,
        'gspot.toml': buildSandboxSettings([], { tables: SCOPE_READER_PROJECT_TABLES }),
    });

    const failed = await runChecks(await openSession(sandbox.path), options);

    expect(failed.report.checks).toMatchObject([...ENVIRONMENT_SCOPE_RESULTS]);
    await createFileTree(sandbox.path, SCOPE_FUNCTION_CORRECTIONS);
    const corrected = await runChecks(await openSession(sandbox.path), options);

    expect(corrected.report.checks.map((check) => check.status)).toStrictEqual(['passed', 'passed', 'passed']);
});

test('a scope with env reads and no example env file is skipped with a note', async () => {
    await using sandbox = await createGitSandbox({
        '.env.example': 'KNOWN=value\n',
        'app/source.ts': 'process.env.MISSING;\n',
        'gspot.toml': buildSandboxSettings(['data-files'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['data-files'] }],
        }),
    });
    const checked = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['secrets/environment-examples'], paths: ['app/source.ts'] }),
    );

    expect(checked.report.checks).toMatchObject([
        {
            check: 'secrets/environment-examples',
            scope: 'app',
            status: 'skipped',
            findings: [],
            note: expect.stringContaining('secrets.environment_examples') as string,
        },
    ]);
});

test('import.meta.env and Deno.env reads in component and module files need example keys', async () => {
    const settings = buildSandboxSettings(['data-files'], { level: 'all' });
    await using sandbox = await createGitSandbox({
        'gspot.toml': settings,
        '.env.example': 'KNOWN=example\n',
        ...ENV_ACCESSOR_FILES,
    });
    const rejected = await runSandboxCheck(sandbox.path, 'secrets/environment-examples');
    expect(rejected.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        ...COMPONENT_ENVIRONMENT_FINDINGS,
    ]);
    await createFileTree(sandbox.path, { '.env.example': ENV_ACCESSOR_EXAMPLE });
    expect(await runSandboxCheck(sandbox.path, 'secrets/environment-examples')).toStrictEqual([]);
});

test.each([...ENVIRONMENT_TEXT_CASES])('$name', async ({ files, changed, findings: expected }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['secrets']),
        ...files,
    });
    expect(await runSandboxCheck(sandbox.path, 'secrets/environment-examples')).toStrictEqual([]);
    await createFileTree(sandbox.path, changed);
    const findings = await runSandboxCheck(sandbox.path, 'secrets/environment-examples');
    expect(findings.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual([...expected]);
});

test('environment-defaults reports a secret with a literal fallback in JavaScript and Python, and no other read', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'python']),
        'config.js': [
            "export const token = process.env.API_TOKEN ?? 'dev-token';",
            "export const key = process.env.API_KEY || 'dev-key';",
            "export const url = process.env.API_URL ?? 'http://localhost';",
            'export const secret = process.env.API_SECRET;',
            'export const password = process.env.DB_PASSWORD ?? fallbackPassword();',
            '',
        ].join('\n'),
        'config.py': [
            'import os',
            'TOKEN = os.environ.get("API_TOKEN", "dev")',
            'KEY = os.getenv("API_KEY", "dev")',
            'URL = os.getenv("API_URL", "dev")',
            'SECRET = os.environ.get("API_SECRET")',
            '',
        ].join('\n'),
    });
    const findings = await runSandboxCheck(sandbox.path, 'secrets/environment-defaults');
    expect(findings.map(({ file, line }) => [file, line])).toStrictEqual([
        ['config.js', 1],
        ['config.js', 2],
        ['config.py', 2],
        ['config.py', 3],
    ]);
});
