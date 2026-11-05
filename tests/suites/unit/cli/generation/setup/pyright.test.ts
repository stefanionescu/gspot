import { expect, test } from 'bun:test';

import { runInit } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each([
    {
        file: 'pyproject.toml',
        text: '[project]\nname = "app"\nversion = "1.0.0"\n[tool.pyright]\ninclude = ["src/app"]\nexclude = ["src/app/legacy"]\n',
    },
    { file: 'pyrightconfig.json', text: '{"include": ["src/app"], "exclude": ["src/app/legacy"]}\n' },
])('init carries the include and exclude of $file as paths that basedpyright leaves out', async ({ file, text }) => {
    await using sandbox = await createGitSandbox({
        [file]: text,
        'src/app/main.py': 'VALUE = 1\n',
        'src/app/legacy/old.py': 'VALUE = 2\n',
        'src/tools/build.py': 'VALUE = 3\n',
        'tests/test_main.py': 'VALUE = 4\n',
        'setup.py': 'VALUE = 5\n',
    });
    const { plan, settings } = await runInit(sandbox.path, ['--configurations', 'python']);
    const paths = ['setup.py', 'src/tools/**', 'tests/**', 'src/app/legacy/**'];
    expect(settings['ignore']).toContainEqual({
        check: 'python/basedpyright',
        paths,
        reason: `Carried over from ${file}.`,
    });
    expect(plan.carryover.find(({ path }) => path === file)).toMatchObject({ tool: 'basedpyright', carried: paths });
});
