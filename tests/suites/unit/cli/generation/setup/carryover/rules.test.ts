import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { runInit } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('init adds the Ruff rules that gspot does not run, and carries each rule that the config turns off as an ignore', async () => {
    await using sandbox = await createGitSandbox({
        'ruff.toml':
            'extend-exclude = ["vendor"]\n[lint]\nselect = ["F", "AIR"]\nignore = ["F401"]\n[lint.per-file-ignores]\n"tests/*" = ["F811"]\n',
        'main.py': 'VALUE = 1\n',
        'vendor/other.py': 'VALUE = 2\n',
    });
    const { plan, settings } = await runInit(sandbox.path, ['--configurations', 'python']);
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
    const { plan, settings } = await runInit(sandbox.path, ['--configurations', 'python']);
    expect(settings['tools']).toBeUndefined();
    expect(plan.carryover.find(({ path }) => path === 'ruff.toml')).toMatchObject({ carried: [], dropped: ['I'] });
});

test('init lists a format script that calls a formatter it does not know, with the way to keep it', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"scripts":{"format":"oxfmt .","test":"true"}}',
        'main.ts': 'export {};\n',
    });
    const { plan } = await runInit(sandbox.path, []);
    expect(plan.lintCommands.filter(({ command }) => command === 'oxfmt .')).toMatchObject([
        { file: 'package.json', line: 1, fix: expect.stringContaining('gspot ignore format/prettier') as string },
    ]);
});

test('init lists the Ruff format options it carries in the Ruff row', async () => {
    await using sandbox = await createGitSandbox({
        'ruff.toml': 'line-length = 79\n[format]\nquote-style = "single"\n',
        'main.py': 'VALUE = 1\n',
    });
    const { plan } = await runInit(sandbox.path, ['--configurations', 'python']);
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
    const { settings } = await runInit(sandbox.path, ['--configurations', 'python']);
    expect(settings['ignore']).toStrictEqual([
        { check: 'python/ruff', rule: 'F401', paths: ['**/__init__.py'], reason: 'Carried over from ruff.toml.' },
    ]);
});

test('init reads the Ruff extend-per-file-ignores table', async () => {
    await using sandbox = await createGitSandbox({
        'ruff.toml': '[lint]\nselect = ["F"]\n[lint.extend-per-file-ignores]\n"tests/*" = ["F811"]\n',
        'tests/main.py': 'VALUE = 1\n',
    });
    const { plan } = await runInit(sandbox.path, ['--configurations', 'python']);
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
    const { plan } = await runInit(sandbox.path, ['--configurations', 'python']);
    expect(plan.carryover.find(({ path }) => path === 'ruff.toml')?.dropped).toStrictEqual(['line-too-long']);
});

test('init compares the markdownlint table with what gspot runs', async () => {
    await using sandbox = await createGitSandbox({
        '.markdownlint.json': JSON.stringify({ MD018: true, MD001: false, MD024: { siblings_only: false } }),
        'README.md': '# Example\n',
    });
    const { plan, settings } = await runInit(sandbox.path);
    expect(settings['tools']).toStrictEqual({ markdownlint: { rules: { MD024: { siblings_only: false } } } });
    expect(settings['ignore']).toStrictEqual([
        { check: 'markdown/markdownlint', rule: 'MD001', reason: 'Carried over from .markdownlint.json.' },
    ]);
    expect(plan.carryover.find(({ path }) => path === '.markdownlint.json')).toMatchObject({
        covered: 1,
        carried: ['MD024', 'ignore MD001'],
        reasons: [],
    });
});

test('init compares a markdownlint alias under its rule ID', async () => {
    await using sandbox = await createGitSandbox({
        '.markdownlint.json': '{ "heading-increment": false }',
        'README.md': '# Example\n',
    });
    const { plan } = await runInit(sandbox.path);
    expect(plan.carryover.find(({ path }) => path === '.markdownlint.json')).toMatchObject({
        carried: ['ignore MD001'],
        dropped: [],
    });
});

test('init asks for no reason for a markdownlint rule that markdownlint retired', async () => {
    await using sandbox = await createGitSandbox({
        '.markdownlint.json': '{ "MD002": false }',
        'README.md': '# Example\n',
    });
    const { plan } = await runInit(sandbox.path);
    expect(plan.carryover.find(({ path }) => path === '.markdownlint.json')).toMatchObject({ covered: 1, reasons: [] });
});

test('init compares the rules that the commitlint of the repository prints', async () => {
    await using sandbox = await createGitSandbox({
        '.commitlintrc.json': '{}\n',
        '.gitignore': 'node_modules\n',
        'README.md': '# Example\n',
    });
    const printed = {
        rules: {
            'type-empty': [2, 'never'],
            'body-leading-blank': [0],
            'header-max-length': [2, 'always', 100],
            'subject-case': [2, 'always', 'lower-case'],
            'body-max-length': [2, 'always', 900],
            'type-enum': [2, 'always', ['special']],
        },
    };
    await mkdir(join(sandbox.path, 'node_modules/.bin'), { recursive: true });
    const program = join(sandbox.path, 'node_modules/.bin/commitlint');
    await writeFile(program, `#!/bin/sh\necho '${JSON.stringify(printed)}'\n`);
    await chmod(program, 0o755);
    const { plan, settings } = await runInit(sandbox.path, ['--level', 'all']);
    expect(settings['tools']).toStrictEqual({
        commitlint: { rules: { 'subject-case': ['always', 'lower-case'] } },
    });
    expect(plan.carryover.find(({ path }) => path === '.commitlintrc.json')).toMatchObject({
        covered: 1,
        carried: ['subject-case', 'ignore body-leading-blank', 'ignore header-max-length'],
        reasons: [],
        dropped: ['body-max-length', 'type-enum'],
    });
});

test('init keeps commitlint options out of a rule that the generated config turns off', async () => {
    await using sandbox = await createGitSandbox({
        '.commitlintrc.json': '{}\n',
        '.gitignore': 'node_modules\n',
        'app/package.json': '{"private":true}\n',
        'README.md': '# Example\n',
    });
    await mkdir(join(sandbox.path, 'node_modules/.bin'), { recursive: true });
    const program = join(sandbox.path, 'node_modules/.bin/commitlint');
    await writeFile(program, `#!/bin/sh\necho '{"rules":{"scope-case":[2,"always","lower-case"]}}'\n`);
    await chmod(program, 0o755);
    const { plan } = await runInit(sandbox.path, ['--level', 'all']);
    expect(plan.carryover.find(({ path }) => path === '.commitlintrc.json')).toMatchObject({ dropped: ['scope-case'] });
});
