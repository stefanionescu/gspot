import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { BASH_SANDBOX } from '#tests/config/setup/sandboxes.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { DOC_COMMENT_CASES, SHEBANG_DOC_SCRIPT } from '#tests/config/checks/language/bash/doc-comments.ts';

test('a shebang does not become the first function summary, with or without a blank line', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash']),
        'direct.sh': SHEBANG_DOC_SCRIPT,
        'spaced.sh': SHEBANG_DOC_SCRIPT.replace('bash\n', 'bash\n\n'),
    });
    expect(await runSandboxCheck(sandbox.path, 'bash/doc-comments')).toStrictEqual([]);
});

test.each([...DOC_COMMENT_CASES])(
    '$check reports $expected.rule in $expected.file and passes after the fix',
    async (sample) => {
        await using sandbox = await createSandbox(BASH_SANDBOX);
        await assertCheckSample(sandbox, sample, BASH_SANDBOX.cleanSource);
    },
);

test('camelCase and uppercase names cannot serve as their own summaries', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
        'source.sh':
            '# loadConfig: load config\nloadConfig() { true; }\n# LOAD_CONFIG: load config\nLOAD_CONFIG() { true; }\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'bash/doc-comments');
    expect(findings.map(({ line }) => line)).toStrictEqual([2, 4]);
    expect(findings.every(({ rule }) => rule === 'vague-summary')).toBe(true);
});

test('a public function that reads arguments needs an Arguments section, and a private one does not', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
        'source.sh': [
            '# greet_user: prints a greeting for one user.',
            String.raw`greet_user() { printf "%s\n" "$1"; }`,
            '# _greet_quietly: prints a greeting for one user.',
            String.raw`_greet_quietly() { printf "%s\n" "$1"; }`,
            '# greet_all: prints a greeting for each user.',
            '# Arguments:',
            '#   User names.',
            String.raw`greet_all() { printf "%s\n" "$@"; }`,
            '# greet_world: prints a greeting for everyone.',
            String.raw`greet_world() { printf "hello\n"; }`,
            '',
        ].join('\n'),
    });
    const findings = await runSandboxCheck(sandbox.path, 'bash/doc-comments');
    expect(findings.map(({ line, rule, message }) => ({ line, rule, message }))).toStrictEqual([
        {
            line: 2,
            rule: 'missing-arguments',
            message:
                'greet_user is public and reads arguments, but its comment has no "# Arguments:" section that lists them.',
        },
    ]);
});
