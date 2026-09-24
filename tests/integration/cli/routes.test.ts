import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { createFileTree, testdir } from 'testdirs';
import { executeRun } from '#cli/run/execute.ts';
import { openSession } from '#cli/run/session.ts';

const OPTIONS = {
    stage: 'all' as const,
    skips: [],
    only: ['express/routes-tested'],
    fix: false,
    isDryRun: false,
    noCache: true,
};
const POLICY = `version = 1
level = "all"
configurations = ["express"]
[tools.express]
route_glob = ["routes/*.ts"]
[[scope]]
path = "api"
configurations = ["express"]
`;
const ROUTE = 'export const users = () => [];\n';

test('route imports must resolve to the route in the same scope', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': POLICY,
        'routes/users.ts': ROUTE,
        'api/routes/users.ts': ROUTE,
        'api/users.test.ts': "import { users } from '../routes/users.ts'; users();\n",
        'users.test.ts': "// import { users } from './routes/users.ts';\nexport const label = 'users';\n",
    });
    const untested = await executeRun(await openSession(sandbox.path), OPTIONS);
    expect(untested.report.exitCode).toBe(1);
    expect(
        untested.report.checks
            .flatMap((check) => check.findings.map((finding) => finding.file))
            .toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(['api/routes/users.ts', 'routes/users.ts']);
    writeFileSync(join(sandbox.path, 'users.test.ts'), "import { users } from './routes/users.js'; users();\n");
    writeFileSync(
        join(sandbox.path, 'api/users.test.ts'),
        "const { users } = await import('./routes/users.ts'); users();\n",
    );
    const tested = await executeRun(await openSession(sandbox.path), OPTIONS);
    expect(tested.report.checks.map((check) => check.scope).toSorted((a, b) => a.localeCompare(b))).toEqual([
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
        'gspot.toml':
            'version = 1\nlevel = "all"\nconfigurations = ["express"]\n[tools.express]\nroute_glob = ["routes/*.ts"]\n',
        'package.json': '{"imports":{"#routes/*":"./routes/*.ts"}}',
        'tsconfig.json': '{"compilerOptions":{"paths":{"@routes/*":["./routes/*"]}}}',
        'routes/users.ts': ROUTE,
        'users.test.ts': `import { test } from 'uninstalled-test-runner';\n${source}\ntest('users', users);\n`,
    });
    const outcome = await executeRun(await openSession(sandbox.path), OPTIONS);
    expect(outcome.report.checks[0]?.status, JSON.stringify(outcome.report.checks)).toBe('ok');
    expect(outcome.report.exitCode).toBe(0);
});
