import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { runChecks } from '#cli/commands/check/run.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

import {
    ENV_ACCESSOR_FILES,
    ENV_ACCESSOR_EXAMPLE,
    BUN_ENVIRONMENT_RESULTS,
    ENVIRONMENT_SCOPE_RESULTS,
    SCOPE_FUNCTION_CORRECTIONS,
    ENVIRONMENT_FUNCTION_EXAMPLE,
    ENVIRONMENT_FUNCTION_FINDINGS,
    COMPONENT_ENVIRONMENT_FINDINGS,
} from '#tests/config/checks/general/secrets.ts';

test('a nested scope uses the default example environment file names', async () => {
    const NESTED_ENV_FILES = {
        'app/.env.example': 'KNOWN=example\n',
        'app/source.ts': 'process.env.KNOWN; process.env.MISSING;\n',
    } as const;

    await using sandbox = await testdir({
        ...NESTED_ENV_FILES,
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
    const READER_PROJECT = {
        ...({
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
        } as const),
        'gspot.toml': buildSandboxSettings([], {
            tables: `[secrets]
env_examples = ["example.env"]
environment_functions = ["config.$env", "$readEnv", "read_env"]
`,
        }),
    };

    const options = buildRunOptions({ only: ['secrets/env-examples'] });
    await using sandbox = await testdir(READER_PROJECT);

    const failed = await runChecks(await openSession(sandbox.path), options);

    expect(failed.report.checks).toMatchObject([
        { check: 'secrets/env-examples', status: 'failed', findings: ENVIRONMENT_FUNCTION_FINDINGS },
    ]);
    await createFileTree(sandbox.path, { 'config/example.env': ENVIRONMENT_FUNCTION_EXAMPLE });
    const corrected = await runChecks(await openSession(sandbox.path), options);

    expect(corrected.report.checks).toMatchObject([{ check: 'secrets/env-examples', status: 'passed', findings: [] }]);
});

test('each scope checks its own example env files and environment functions', async () => {
    const SCOPE_READER_PROJECT = {
        ...({
            '.env.example': 'APP_MISSING=example\n',
            'source.ts': 'root_env("ROOT_MISSING");\n',
            'app/project.env': 'APP_KEY=example\nSIBLING_MISSING=example\n',
            'app/source.ts': 'config.$env("APP_KEY"); $readEnv("APP_MISSING");\n',
            'sibling/.env.example': 'KNOWN=example\n',
            'sibling/source.ts': 'Bun.env.SIBLING_MISSING;\n',
        } as const),
        'gspot.toml': buildSandboxSettings([], {
            tables: `[secrets]
environment_functions = ["root_env"]
[[scope]]
path = "app"

[scope.secrets]
env_examples = ["project.env"]
environment_functions = ["config.$env", "$readEnv"]
[[scope]]
path = "sibling"

[scope.secrets]
env_examples = [".env.example"]
`,
        }),
    };

    const options = buildRunOptions({ only: ['secrets/env-examples'] });
    await using sandbox = await testdir(SCOPE_READER_PROJECT);

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
        { check: 'secrets/env-examples', scope: '', status: 'skipped', findings: [], note: 'No matching files.' },
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
