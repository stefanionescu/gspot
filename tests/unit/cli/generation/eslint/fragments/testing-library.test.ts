import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { settingsText } from '#tests/setup/settings.ts';
import { createEslint, lintFindings } from '#tests/setup/generate.ts';

test.each([
    ['react', '@testing-library/react'],
    ['vue', '@testing-library/vue'],
    ['svelte', '@testing-library/svelte'],
])('Testing Library with %s reports debugging only in dependency-owned test files', async (framework, library) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['javascript', framework, 'testing-library'], {
            level: 'all',
            tables: '[[scope]]\npath = "child"\n\n[[scope]]\npath = "neighbor"\nremoved_configurations = [ "testing-library" ]\n',
        }),
        'package.json': JSON.stringify({ private: true, dependencies: { [library]: '1.0.0' } }),
        'child/package.json': '{"private":true,"dependencies":{}}\n',
        'neighbor/package.json': JSON.stringify({ private: true, dependencies: { [library]: '1.0.0' } }),
        'source.test.js': '',
        'child/source.test.js': '',
        'neighbor/source.test.js': '',
    });
    const eslint = await createEslint(sandbox.path);
    const source = `import { screen } from '${library}';\nscreen.debug();\n`;
    const paths = ['source.test.js', 'source.js', 'child/source.test.js', 'neighbor/source.test.js'];
    await createFileTree(sandbox.path, Object.fromEntries(paths.map((path) => [path, source])));
    expect(await lintFindings(eslint, sandbox.path, paths, ['testing-library/no-debugging-utils'])).toStrictEqual([
        { file: 'source.test.js', rule: 'testing-library/no-debugging-utils', line: 2 },
    ]);
    await createFileTree(sandbox.path, {
        'source.test.js': `import { screen } from '${library}';\nscreen.getByRole('button');\n`,
    });
    expect(
        await lintFindings(eslint, sandbox.path, ['source.test.js'], ['testing-library/no-debugging-utils']),
    ).toStrictEqual([]);
});
