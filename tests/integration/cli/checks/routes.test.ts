import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { CHECKS } from '#cli/checks/registry.ts';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';

const ROUTES_POLICY = `level = "all"
kits = ["express"]
[tools.express]
route_files = ["routes/*.ts"]
[[scope]]
path = "api"
kits = ["express"]
`;

const ROUTES_OPTIONS = {
    stage: 'all' as const,
    skips: [],
    only: ['express/routes-tested'],
    fix: false,
    isDryRun: false,
};

const ROUTE = 'export const users = () => [];\n';

test('route imports must resolve to the route in the same scope', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': ROUTES_POLICY,
        'routes/users.ts': ROUTE,
        'api/routes/users.ts': ROUTE,
        'api/users.test.ts': "import { users } from '../routes/users.ts'; users();\n",
        'users.test.ts': "// import { users } from './routes/users.ts';\nexport const label = 'users';\n",
    });
    const untested = await executeRun(await openSession(sandbox.path), { ...ROUTES_OPTIONS, checks: CHECKS });
    expect(untested.report.exitCode).toBe(1);
    expect(
        untested.report.checks
            .flatMap((check) => check.findings.map((finding) => finding.file))
            .toSorted((a, b) => a.localeCompare(b)),
    ).toStrictEqual(['api/routes/users.ts', 'routes/users.ts']);
    writeFileSync(join(sandbox.path, 'users.test.ts'), "import { users } from './routes/users.js'; users();\n");
    writeFileSync(
        join(sandbox.path, 'api/users.test.ts'),
        "const { users } = await import('./routes/users.ts'); users();\n",
    );
    const tested = await executeRun(await openSession(sandbox.path), { ...ROUTES_OPTIONS, checks: CHECKS });
    expect(tested.report.checks.map((check) => check.scope).toSorted((a, b) => a.localeCompare(b))).toStrictEqual([
        '',
        'api',
    ]);
    expect(tested.report.exitCode, JSON.stringify(tested.report.checks)).toBe(0);
});

test.each([
    "const { users } = require('./routes/users.ts'); users();",
    "import { users } from '#routes/users'; users();",
    "import { users } from '@routes/users'; users();",
])('a route test resolves its module through %s', async (source) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['express'], '[tools.express]\nroute_files = ["routes/*.ts"]\n', 'all'),
        'package.json': '{"imports":{"#routes/*":"./routes/*.ts"}}',
        'tsconfig.json': '{"compilerOptions":{"paths":{"@routes/*":["./routes/*"]}}}',
        'routes/users.ts': ROUTE,
        'users.test.ts': `import { test } from 'uninstalled-test-runner';\n${source}\ntest('users', users);\n`,
    });
    const outcome = await executeRun(await openSession(sandbox.path), { ...ROUTES_OPTIONS, checks: CHECKS });
    expect(outcome.report.checks[0]?.status, JSON.stringify(outcome.report.checks)).toBe('ok');
    expect(outcome.report.exitCode).toBe(0);
});
