import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { openSession } from '#cli/engine/session.ts';
import { runChecks } from '#cli/engine/run/checks.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runSandboxCheck, openFakeToolSession } from '#tests/setup/cli/checks.ts';

import {
    ENV_ACCESSOR_EXAMPLE,
    ENVIRONMENT_SCOPE_RESULTS,
    ENVIRONMENT_FUNCTION_EXAMPLE,
    ENVIRONMENT_FUNCTION_FINDINGS,
    COMPONENT_ENVIRONMENT_FINDINGS,
} from '#tests/config/configurations/general.ts';

test('keys read through Bun.env and environment functions are reported until the example file lists them', async () => {
    await using sandbox = await createGitSandbox({
        'config/example.env': 'export KNOWN=example\n# ignored\n',
        'source.ts': `Bun.env.KNOWN; Bun.env.MISSING; process.env["MISSING"];
config.$env("CUSTOM");
$readEnv("DOLLAR");
otherconfig.$env("UNDECLARED"); process.env.MISSING;
`,
        'reader.py': `import os; read_env("PYTHON"); read_env("PYTHON"); os.environ["MISSING"]; os.getenv("OTHER");
os.environ.get("OTHER");
`,
        'notes.txt': 'Bun.env.TEXT; $readEnv("TEXT");\n',
        'gspot.toml': buildSandboxSettings([], {
            tables: `[secrets]
environment_examples = ["example.env"]
environment_functions = ["config.$env", "$readEnv", "read_env"]
`,
        }),
    });

    expect(await runSandboxCheck(sandbox.path, 'secrets/environment-examples')).toMatchObject(
        ENVIRONMENT_FUNCTION_FINDINGS.map(({ key, ...finding }) => ({
            ...finding,
            message: expect.stringContaining(key) as string,
        })),
    );
    await createFileTree(sandbox.path, { 'config/example.env': ENVIRONMENT_FUNCTION_EXAMPLE });
    expect(await runSandboxCheck(sandbox.path, 'secrets/environment-examples')).toStrictEqual([]);
});

test('each scope checks its own example env files and environment functions', async () => {
    const options = buildRunOptions({ only: ['secrets/environment-examples'] });
    await using sandbox = await createGitSandbox({
        '.env.example': 'APP_MISSING=example\n',
        'source.ts': 'root_env("ROOT_MISSING");\n',
        'app/project.env': 'APP_KEY=example\nSIBLING_MISSING=example\n',
        'app/source.ts': 'config.$env("APP_KEY"); $readEnv("APP_MISSING");\n',
        'sibling/.env.example': 'KNOWN=example\n',
        'sibling/source.ts': 'Bun.env.SIBLING_MISSING;\n',
        'gspot.toml': buildSandboxSettings([], {
            tables: `[secrets]
environment_functions = ["root_env"]
[[scope]]
path = "app"

[scope.secrets]
environment_examples = ["project.env"]
environment_functions = ["config.$env", "$readEnv"]
[[scope]]
path = "sibling"

[scope.secrets]
environment_examples = [".env.example"]
`,
        }),
    });

    const failed = await runChecks(await openSession(sandbox.path), options);

    expect(failed.report.checks).toMatchObject([...ENVIRONMENT_SCOPE_RESULTS]);
    await createFileTree(sandbox.path, {
        '.env.example': 'APP_MISSING=example\nROOT_MISSING=example\n',
        'app/project.env': `APP_KEY=example
SIBLING_MISSING=example
APP_MISSING=example
`,
        'sibling/.env.example': 'KNOWN=example\nSIBLING_MISSING=example\n',
    });
    const corrected = await runChecks(await openSession(sandbox.path), options);

    expect(corrected.report.checks.map((check) => check.status)).toStrictEqual(['passed', 'passed', 'passed']);
});

test('a scope with env reads and no example env file is skipped with a note', async () => {
    await using sandbox = await createGitSandbox({
        '.env.example': 'KNOWN=value\n',
        'app/source.ts': 'process.env.MISSING;\n',
        'gspot.toml': buildSandboxSettings(['yaml'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['yaml'] }],
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
    const settings = buildSandboxSettings(['yaml'], { level: 'all' });
    await using sandbox = await createGitSandbox({
        'gspot.toml': settings,
        '.env.example': 'KNOWN=example\n',
        'app.astro': '---\nconst endpoint = import.meta.env.VITE_API;\n---\n<main>{endpoint}</main>\n',
        'app.svelte': '<script>const endpoint = import.meta.env["SVELTE_API"];</script>\n<main>{endpoint}</main>\n',
        'app.vue': `<script setup>const endpoint = import.meta.env.VUE_API;</script>
<template>{{ endpoint }}</template>
`,
        'worker.ts': 'const endpoint = Deno.env.get("DENO_API");\nDeno.env.get("DENO_API");\n',
        'module.mts': 'export const endpoint = import.meta.env.MODULE_API;\n',
        'legacy.cjs': 'exports.endpoint = process.env.LEGACY_API;\n',
        'notes.txt': 'import.meta.env.UNREAD_API; Deno.env.get("UNREAD_API");\n',
    });
    const rejected = await runSandboxCheck(sandbox.path, 'secrets/environment-examples');
    expect(rejected.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        ...COMPONENT_ENVIRONMENT_FINDINGS,
    ]);
    await createFileTree(sandbox.path, { '.env.example': ENV_ACCESSOR_EXAMPLE });
    expect(await runSandboxCheck(sandbox.path, 'secrets/environment-examples')).toStrictEqual([]);
});

test('a key listed as a commented line counts as listed', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['secrets']),
        '.env.example': '# TOKEN=example\n',
        'source.ts': 'process.env.TOKEN;\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'secrets/environment-examples')).toStrictEqual([]);
    await createFileTree(sandbox.path, { '.env.example': '# Other keys\n' });
    const findings = await runSandboxCheck(sandbox.path, 'secrets/environment-examples');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'source.ts', rule: 'missing-key' },
    ]);
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

test('gitleaks-pushed passes without a run when no commit is pushed', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['secrets']),
        'source.js': 'export const value = 1;\n',
    });
    using resources = new DisposableStack();
    const session = await openFakeToolSession(sandbox.path, ['gitleaks'], resources);
    const spawn = resources.use(fakeCommands());
    const result = await runChecks(
        session,
        buildRunOptions({
            stage: 'push',
            only: ['secrets/gitleaks-pushed'],
            selection: { content: 'working-tree', commits: [] },
        }),
    );
    expect(result.report.checks).toMatchObject([{ check: 'secrets/gitleaks-pushed', status: 'passed' }]);
    expect(spawn).not.toHaveBeenCalled();
});
