import { test, expect } from 'bun:test';
import { planSandboxInit } from '#tests/setup/cli/commands.ts';
import { writeProgramCommand } from '#tests/setup/system/programs.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('init compares the markdownlint table with what gspot runs', async () => {
    await using sandbox = await createGitSandbox({
        '.markdownlint.json': JSON.stringify({ MD018: true, MD001: false, MD024: { siblings_only: false } }),
        'README.md': '# Example\n',
    });
    const { plan, settings } = await planSandboxInit(sandbox.path);
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

test('init asks for no reason for a markdownlint rule that markdownlint retired', async () => {
    await using sandbox = await createGitSandbox({
        '.markdownlint.json': '{ "MD002": false }',
        'README.md': '# Example\n',
    });
    const { plan } = await planSandboxInit(sandbox.path);
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
    await writeProgramCommand(
        sandbox.path,
        'node_modules/.bin/commitlint',
        'fakes/tool',
        '--stdout',
        JSON.stringify(printed),
    );
    const { plan, settings } = await planSandboxInit(sandbox.path, ['--level', 'all']);
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
