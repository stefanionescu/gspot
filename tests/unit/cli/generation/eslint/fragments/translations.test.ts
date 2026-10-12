import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { I18N_SOURCE } from '#tests/config/eslint/framework.ts';
import { createEslint, lintFindings } from '#tests/setup/generate.ts';

test.each([...LEVELS])('literal UI text is reported outside the test files of each scope at %s', async (level) => {
    await using sandbox = await testdir();
    const tested = ['qa/entry.jsx', 'app/qa/entry.jsx', 'app/verification/entry.jsx', 'app/deep/qa/entry.jsx'];
    const ordinary = new Set(['source.jsx', 'app/source.jsx', 'app/deep/source.jsx']);
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['translations', 'react'], {
            level,
            tables: 'test_files = [ "**/qa/**" ]\n\n[[scope]]\npath = "app"\ntest_files = [ "app/verification/**" ]\n\n[[scope]]\npath = "app/deep"\n\n[[scope]]\npath = "sibling"\nremoved_configurations = [ "translations" ]\n',
        }),
        'package.json': '{"private":true,"type":"module"}\n',
        ...Object.fromEntries([...tested, ...ordinary, 'sibling/source.jsx'].map((path) => [path, I18N_SOURCE])),
    });
    const eslint = await createEslint(sandbox.path);
    for (const file of [...tested, ...ordinary, 'sibling/source.jsx']) {
        expect(await lintFindings(eslint, sandbox.path, [file], ['i18next/no-literal-string']), file).toStrictEqual(
            level === 'all' && ordinary.has(file) ? [{ file, rule: 'i18next/no-literal-string', line: 1 }] : [],
        );
    }
});
