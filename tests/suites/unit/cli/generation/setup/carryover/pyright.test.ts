import { test, expect } from 'bun:test';
import { planSandboxInit } from '#tests/setup/cli/commands.ts';
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
    const { plan, settings } = await planSandboxInit(sandbox.path, ['--configurations', 'python']);
    const unchecked = ['**/*.py', '!src/app', '!src/app/**'];
    const reason = `Carried over from ${file}.`;
    expect(settings['ignore']).toContainEqual({ check: 'python/basedpyright', paths: unchecked, reason });
    expect(settings['ignore']).toContainEqual({ check: 'python/basedpyright', paths: ['src/app/legacy/**'], reason });
    expect(plan.carryover.find(({ path }) => path === file)).toMatchObject({
        tool: 'basedpyright',
        carried: [...unchecked, 'src/app/legacy/**'],
    });
});

test('init carries a pyright include only for what the repository tracks, because gspot/unmatched-paths reports the rest', async () => {
    await using sandbox = await createGitSandbox({
        'pyrightconfig.json': '{"include": ["src/app", "typings"]}\n',
        'src/app/main.py': 'VALUE = 1\n',
        'stubs/app.pyi': 'VALUE: int\n',
    });
    const { settings } = await planSandboxInit(sandbox.path, ['--configurations', 'python']);
    expect(settings['ignore']).toContainEqual({
        check: 'python/basedpyright',
        paths: ['**/*.py', '**/*.pyi', '!src/app', '!src/app/**'],
        reason: 'Carried over from pyrightconfig.json.',
    });
});

test('init lists the typeCheckingMode of a pyright config as dropped', async () => {
    await using sandbox = await createGitSandbox({
        'pyrightconfig.json': '{"typeCheckingMode": "basic"}\n',
        'main.py': 'VALUE = 1\n',
    });
    const { plan } = await planSandboxInit(sandbox.path, ['--configurations', 'python']);
    expect(plan.carryover.find(({ path }) => path === 'pyrightconfig.json')?.dropped).toStrictEqual([
        'typeCheckingMode',
    ]);
});
