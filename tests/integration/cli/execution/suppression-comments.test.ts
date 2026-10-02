import { ESLint } from 'eslint';
import { test, expect } from 'bun:test';
import { CHECKS } from '#cli/checks/registry.ts';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { suppressionComments } from '#cli/checks/general/structure/suppressions.ts';

test.each([
    ['// Example eslint-disable-next-line no-console', false],
    ['// eslint-disable no-console', false],
    ['/* Example eslint-disable no-console */', false],
    ['/** Documentation\n * eslint-disable no-console\n */', false],
    ['// eslint-disable-next-line no-console', true],
    ['/* eslint-disable no-console */', true],
    ['/*\n eslint-disable no-console\n */', true],
    ['/*eslint-disable*/', true],
    ['/*eslint-disable-next-line*/', true],
    ['// eslint-disable-next-line*/', false],
    ['/*eslint-disable-unknown*/', false],
] as const)('suppression comments agree with ESLint for %s', async (comment, active) => {
    await using sandbox = await testdir();
    const source = `${comment}\nconsole.log(1);\n`;
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['javascript'], '', 'all'),
        'source.js': source,
    });
    const session = await openSession(sandbox.path);
    const comments = await suppressionComments(session.root, session.scopes, session.reads, session.repository.files);
    const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: { rules: { 'no-console': 'error' } } });
    const native = await eslint.lintText(source, { filePath: 'source.js' });
    expect(native[0]!.suppressedMessages).toHaveLength(active ? 1 : 0);
    expect(comments.map(({ line, form }) => ({ line, form }))).toStrictEqual(
        active ? [{ line: 1, form: 'eslint' }] : [],
    );
});

test.each([
    [
        'source.ts',
        '// reason: The external interface requires this call.\n// eslint-disable-next-line no-console\nconsole.log(1);\n',
        [],
    ],
    [
        'source.sh',
        '# reason: The external command requires word splitting.\n# shellcheck disable=SC2086\necho $name\n',
        [],
    ],
    [
        'source.ts',
        '// reason: The external interface requires this call.\n\n// eslint-disable-next-line no-console\nconsole.log(1);\n',
        [3],
    ],
    [
        'source.ts',
        'const text = "// reason: The external interface requires this call.";\n// eslint-disable-next-line no-console\nconsole.log(1);\n',
        [2],
    ],
    [
        'source.ts',
        '// reason: The external interface requires this call.\n// eslint-disable-next-line no-console -- N/A\nconsole.log(1);\n',
        [2],
    ],
] as const)(
    'suppression reasons immediately above %s require an adjacent explanation comment',
    async (path, source, lines) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'level = "all"\nrequire_reasons = true\nkits = ["typescript", "bash"]\n',
            [path]: source,
        });
        const result = await executeRun(await openSession(sandbox.path), {
            checks: CHECKS,
            stage: 'commit',
            only: ['integrity/suppressions'],
            skips: [],
            fix: false,
            isDryRun: true,
        });
        expect(result.report.checks.map(({ status }) => status)).toStrictEqual([lines.length === 0 ? 'ok' : 'fail']);
        expect(result.report.checks.flatMap(({ findings }) => findings.map(({ line }) => line))).toStrictEqual([
            ...lines,
        ]);
    },
);

test.each(['-->', '--!>'])(
    'HTML suppression reasons exclude the %s terminator and still require a reason',
    async (ending) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'level = "all"\nrequire_reasons = true\nkits = ["html", "structure"]\n',
            'page.html': `<!-- html-validate-disable attr -- External validator owns this attribute. ${ending}\n<!-- html-validate-disable attr ${ending}\n`,
        });
        const session = await openSession(sandbox.path);
        const comments = await suppressionComments(
            session.root,
            session.scopes,
            session.reads,
            session.repository.files,
        );
        expect(comments).toStrictEqual([
            {
                file: 'page.html',
                line: 1,
                form: 'html-validate',
                forbidden: false,
                reason: 'External validator owns this attribute.',
            },
            { file: 'page.html', line: 2, form: 'html-validate', forbidden: false },
        ]);
        const result = await executeRun(session, {
            checks: CHECKS,
            stage: 'commit',
            skips: [],
            fix: false,
            isDryRun: false,
            only: ['integrity/suppressions'],
        });
        expect(result.report.exitCode).toBe(1);
        expect(
            result.report.checks.flatMap((check) => check.findings).map(({ file, line }) => ({ file, line })),
        ).toStrictEqual([{ file: 'page.html', line: 2 }]);
    },
);
