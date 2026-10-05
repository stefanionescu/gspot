import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';

test('generated boundaries report a cross-project import once and fix scoped aliases from the repository root', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript'], {
            level: 'all',
            tables: '[agent_rules]\nenabled = false\n[[scope]]\npath = "apps/api"\nconfigurations = ["javascript"]\n[[scope]]\npath = "apps/web"\nconfigurations = ["javascript"]\n[[scope]]\npath = "services/db"\nconfigurations = ["javascript"]\n',
        }),
        'package.json': '{"name":"boundaries","private":true,"type":"module"}',
        'apps/api/package.json':
            '{"name":"api","private":true,"type":"module","imports":{"#shared/*":"./src/shared/*"}}',
        'apps/api/tsconfig.json': '{"compilerOptions":{"baseUrl":".","paths":{"@web/*":["../web/src/*"]}}}',
        'apps/web/package.json': '{"name":"web","private":true,"type":"module"}',
        'apps/web/src/a.js': 'export const a = 1;\n',
        'services/db/a.js': 'export const a = 1;\n',
        'apps/api/src/shared/a.js': 'export const a = 1;\n',
        'apps/api/src/task.js': "import { a } from '../../../services/db/a.js';\nconsole.log(a);\n",
        'apps/api/src/feature/task.js': "import { a } from '../../../web/src/a.js';\nconsole.log(a);\n",
    });
    const eslint = await createEslint(sandbox.path);
    const defect = await eslint.lintFiles(['apps/api/src/task.js']);
    expect(
        defect.flatMap(({ messages }) => messages.filter(({ ruleId }) => ruleId === 'gspot/import-boundaries')),
    ).toMatchObject([{ line: 1, messageId: 'escape' }]);
    const aliases = await eslint.lintFiles(['apps/api/src/feature/task.js']);
    const aliasFindings = aliases.flatMap(({ messages }) =>
        messages.filter(({ ruleId }) => ruleId === 'gspot/import-boundaries'),
    );
    expect(aliasFindings).toMatchObject([{ line: 1, messageId: 'alias', fix: { text: "'@web/a.js'" } }]);
    const fixedAlias = await eslint.lintText("import { a } from '@web/a.js';\nconsole.log(a);\n", {
        filePath: 'apps/api/src/feature/task.js',
    });
    expect(
        fixedAlias.flatMap(({ messages }) => messages.filter(({ ruleId }) => ruleId === 'gspot/import-boundaries')),
    ).toStrictEqual([]);
    // A deeper project boundary still permits relative paths within that project. Source folder defaults select apps/api.
    await Bun.write(
        join(sandbox.path, 'apps/api/src/task.js'),
        "import { a } from './shared/a.js';\nconsole.log(a);\n",
    );
    const corrected = await eslint.lintFiles(['apps/api/src/task.js']);
    expect(
        corrected.flatMap(({ messages }) => messages.filter(({ ruleId }) => ruleId === 'gspot/import-boundaries')),
    ).toStrictEqual([]);
});
