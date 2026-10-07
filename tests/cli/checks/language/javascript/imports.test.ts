import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { ROUTE, ROUTES_POLICY } from '#tests/config/cli/checks/imports.ts';
import { getScopeImports } from '#cli/checks/language/javascript/imports.ts';

test('import graphs exclude comments and imports outside their owning scope', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': ROUTES_POLICY,
        'routes/users.ts': ROUTE,
        'api/routes/users.ts': ROUTE,
        'api/users.test.ts': "import { users } from '../routes/users.ts'; users();\n",
        'users.test.ts': "// import { users } from './routes/users.ts';\nexport const label = 'users';\n",
    });
    const session = await openSession(sandbox.path);
    const check = session.manifests.get('javascript')!.checks.find((entry) => entry.name === 'javascript/eslint')!;
    const root = await getScopeImports(buildCheckInput(session, check.name));
    const api = await getScopeImports(buildCheckInput(session, check.name, { scope: 'api' }));
    expect(root.importers).toStrictEqual(new Map());
    expect(root.paths).not.toContain('api/routes/users.ts');
    expect(api.importers).toStrictEqual(new Map());
    expect(api.paths).not.toContain('routes/users.ts');
    writeFileSync(join(sandbox.path, 'users.test.ts'), "import { users } from './routes/users.js'; users();\n");
    writeFileSync(
        join(sandbox.path, 'api/users.test.ts'),
        "const { users } = await import('./routes/users.ts'); users();\n",
    );
    const corrected = await openSession(sandbox.path);
    const correctedRoot = await getScopeImports(buildCheckInput(corrected, check.name));
    const correctedApi = await getScopeImports(buildCheckInput(corrected, check.name, { scope: 'api' }));
    expect(correctedRoot.importers).toStrictEqual(new Map([['routes/users.ts', new Set(['users.test.ts'])]]));
    expect(correctedApi.importers).toStrictEqual(new Map([['api/routes/users.ts', new Set(['api/users.test.ts'])]]));
});

test.each([
    "const { users } = require('./routes/users.ts'); users();",
    "import { users } from '#routes/users'; users();",
    "import { users } from '@routes/users'; users();",
])('the import graph resolves a module through %s', async (source) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript'], { level: 'all' }),
        'package.json': '{"imports":{"#routes/*":"./routes/*.ts"}}',
        'tsconfig.json': '{"compilerOptions":{"paths":{"@routes/*":["./routes/*"]}}}',
        'routes/users.ts': ROUTE,
        'users.test.ts': `import { test } from 'uninstalled-test-runner';\n${source}\ntest('users', users);\n`,
    });
    const session = await openSession(sandbox.path);
    const check = session.manifests.get('javascript')!.checks.find((entry) => entry.name === 'javascript/eslint')!;
    const graph = await getScopeImports(buildCheckInput(session, check.name));
    expect(graph.importers).toStrictEqual(new Map([['routes/users.ts', new Set(['users.test.ts'])]]));
});
