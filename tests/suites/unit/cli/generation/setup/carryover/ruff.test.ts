import { expect, test } from 'bun:test';

import { planSandboxInit } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('init adds the Ruff rules that gspot does not run, and carries each rule that the config turns off as an ignore', async () => {
    await using sandbox = await createGitSandbox({
        'ruff.toml':
            'extend-exclude = ["vendor"]\n[lint]\nselect = ["F", "AIR"]\nignore = ["F401"]\n[lint.per-file-ignores]\n"tests/*" = ["F811"]\n',
        'main.py': 'VALUE = 1\n',
        'vendor/other.py': 'VALUE = 2\n',
    });
    const { plan, settings } = await planSandboxInit(sandbox.path, ['--configurations', 'python']);
    expect(settings['tools']).toStrictEqual({ ruff: { rules: ['AIR'] } });
    expect(settings['ignore']).toStrictEqual([
        { check: 'python/ruff', paths: ['**/vendor/**'], reason: 'Carried over from ruff.toml.' },
        { check: 'python/ruff-format', paths: ['**/vendor/**'], reason: 'Carried over from ruff.toml.' },
        { check: 'python/ruff', rule: 'F401', reason: 'Carried over from ruff.toml.' },
        { check: 'python/ruff', rule: 'F811', paths: ['tests/*'], reason: 'Carried over from ruff.toml.' },
    ]);
    expect(plan.carryover.find(({ path }) => path === 'ruff.toml')).toMatchObject({
        covered: 1,
        carried: ['AIR', 'ignore F401', 'ignore F811 in tests/*', '**/vendor/**'],
        reasons: [],
    });
});

test('init lists Ruff I as dropped, because gspot sets the import order', async () => {
    await using sandbox = await createGitSandbox({
        'ruff.toml': '[lint]\nselect = ["F", "I"]\n',
        'main.py': 'VALUE = 1\n',
    });
    const { plan, settings } = await planSandboxInit(sandbox.path, ['--configurations', 'python']);
    expect(settings['tools']).toBeUndefined();
    expect(plan.carryover.find(({ path }) => path === 'ruff.toml')).toMatchObject({ carried: [], dropped: ['I'] });
});

test('init lists the Ruff format options it carries in the Ruff row', async () => {
    await using sandbox = await createGitSandbox({
        'ruff.toml': 'line-length = 79\n[format]\nquote-style = "single"\n',
        'main.py': 'VALUE = 1\n',
    });
    const { plan } = await planSandboxInit(sandbox.path, ['--configurations', 'python']);
    expect(plan.carryover.find(({ path }) => path === 'ruff.toml')?.carried).toStrictEqual([
        'line-length',
        'format.quote-style',
    ]);
});

test('init anchors a Ruff per-file key without a slash at every folder', async () => {
    await using sandbox = await createGitSandbox({
        'ruff.toml': '[lint]\nselect = ["F"]\n[lint.per-file-ignores]\n"__init__.py" = ["F401"]\n',
        'pkg/__init__.py': 'VALUE = 1\n',
    });
    const { settings } = await planSandboxInit(sandbox.path, ['--configurations', 'python']);
    expect(settings['ignore']).toStrictEqual([
        { check: 'python/ruff', rule: 'F401', paths: ['**/__init__.py'], reason: 'Carried over from ruff.toml.' },
    ]);
});

test('init reads the Ruff extend-per-file-ignores table', async () => {
    await using sandbox = await createGitSandbox({
        'ruff.toml': '[lint]\nselect = ["F"]\n[lint.extend-per-file-ignores]\n"tests/*" = ["F811"]\n',
        'tests/main.py': 'VALUE = 1\n',
    });
    const { plan } = await planSandboxInit(sandbox.path, ['--configurations', 'python']);
    expect(plan.carryover.find(({ path }) => path === 'ruff.toml')).toMatchObject({
        carried: ['ignore F811 in tests/*'],
        dropped: [],
    });
});

test('init names a Ruff rule name in lint.ignore, which it cannot compare', async () => {
    await using sandbox = await createGitSandbox({
        'ruff.toml': '[lint]\nselect = ["F"]\nignore = ["line-too-long"]\n',
        'main.py': 'VALUE = 1\n',
    });
    const { plan } = await planSandboxInit(sandbox.path, ['--configurations', 'python']);
    expect(plan.carryover.find(({ path }) => path === 'ruff.toml')?.dropped).toStrictEqual(['line-too-long']);
});
