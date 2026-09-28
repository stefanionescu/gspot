import { ESLint } from 'eslint';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { suppressionComments } from '#cli/checks/repository/suppressions.ts';
import { applyInlineIgnores, inlineIgnores } from '#cli/execution/ignores.ts';

test.each([
    ['source.html', '<!-- gspot-ignore structure/custom -- Required interface. --!>', 'Required interface.'],
    ['source.ts', '// gspot-ignore structure/custom -- Preserve the --> mapping.', 'Preserve the --> mapping.'],
] as const)(
    'inline ignore reasons preserve literal text and remove only the native terminator in %s',
    async (path, source, reason) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { [path]: source });
        expect(await inlineIgnores({ root: sandbox.path, sources: new Map() }, path)).toStrictEqual([
            { line: 2, check: 'structure/custom', reason },
        ]);
    },
);

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
] as const)('suppression census agrees with ESLint for %s', async (comment, active) => {
    await using sandbox = await testdir();
    const source = `${comment}\nconsole.log(1);\n`;
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["javascript"]\n',
        'source.js': source,
    });
    const session = await openSession(sandbox.path);
    const comments = await suppressionComments(
        session.root,
        session.scopes,
        session.observations,
        session.repository.files,
    );
    const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: { rules: { 'no-console': 'error' } } });
    const native = await eslint.lintText(source, { filePath: 'source.js' });
    expect(native[0]!.suppressedMessages).toHaveLength(active ? 1 : 0);
    expect(comments.map(({ line, form }) => ({ line, form }))).toStrictEqual(
        active ? [{ line: 1, form: 'eslint' }] : [],
    );
});

test('literal directive text cannot hide an engine finding next to a real inline ignore', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'source.ts': [
            'const fixture = "// gspot-ignore structure/custom -- Required external interface.";',
            '// gspot-ignore structure/custom -- Required external interface.',
            'const actual = 1;',
            'const described = 1; /* Example // gspot-ignore structure/custom -- Literal documentation. */',
        ].join('\n'),
    });
    const findings = [1, 3, 4].map((line) => ({
        check: 'structure/custom',
        engine: 'structure',
        file: 'source.ts',
        line,
        message: 'Required source contract.',
        fixable: false,
    }));
    expect(await applyInlineIgnores({ root: sandbox.path, sources: new Map() }, findings)).toStrictEqual([
        findings[0]!,
        findings[2]!,
    ]);
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
            'gspot.toml':
                'version = 1\nlevel = "all"\nrequire_reasons = true\nconfigurations = ["typescript", "bash"]\n',
            [path]: source,
        });
        const result = await executeRun(await openSession(sandbox.path), {
            stage: 'commit',
            only: ['integrity/suppressions'],
            noCache: true,
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
