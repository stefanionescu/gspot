import { ESLint } from 'eslint';
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { runGspot, buildRunOptions } from '#tests/harness/gspot.ts';
import { containing, containingAll } from '#tests/harness/expectations.ts';
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
        'gspot.toml': buildPolicy(['javascript'], { level: 'all' }),
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
    ['source.sh', '# shellcheck disable=SC2086\necho $name\n', [1]],
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
            'gspot.toml': 'level = "all"\nconfigurations = ["typescript", "bash"]\n',
            [path]: source,
        });
        const session = await openSession(sandbox.path);
        const result = await executeRun(
            session,
            buildRunOptions({ stage: 'commit', only: ['structure/suppressions'], isDryRun: true }),
        );
        expect(result.report.checks.map(({ status }) => status)).toStrictEqual([
            lines.length === 0 ? 'passed' : 'failed',
        ]);
        expect(result.report.checks.flatMap(({ findings }) => findings.map(({ line }) => line))).toStrictEqual([
            ...lines,
        ]);
        for (const finding of result.report.checks.flatMap(({ findings }) => findings)) {
            const name = finding.rule!.replace('-no-reason', '');
            const tool = [...session.manifests.values()]
                .flatMap((manifest) => manifest.tools)
                .find((tool) => tool.name === name && tool.suppression !== undefined)!;
            expect(finding.message).toBe(
                `This ${name} suppression needs a meaningful reason matching ${tool.suppression!.reason}.`,
            );
        }
    },
);

test.each(['recommended', 'all'] as const)('Vale directives fail at %s', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['prose', 'sql'], {
            level,
        }),
        'guide.md':
            '# A page\n\n<!-- vale off -->\n\nText hidden from the prose check.\n\n```markdown\n<!-- vale off -->\n```\n\n`<!-- vale off -->`\n\n<!-- Example vale off -->\n',
        'query.sql': '/* Explains the query. */\nSELECT 1;\n',
        'source.ts': 'const example = "<!-- vale off -->";\n',
    });
    const command = ['check', '--only', 'structure/suppressions', '--json'];
    await Bun.write(join(sandbox.path, 'guide.mdx'), Bun.file(join(sandbox.path, 'guide.md')));
    const failed = await runGspot(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect((JSON.parse(failed.stdout) as RunReport).checks).toMatchObject([
        {
            check: 'structure/suppressions',
            status: 'failed',
            findings: [
                { file: 'guide.md', rule: 'vale', line: 3 },
                { file: 'guide.mdx', rule: 'vale', line: 3 },
            ],
        },
    ]);
    await Bun.write(
        join(sandbox.path, 'guide.md'),
        '# A page\n\nText remains visible to the prose check.\n\n```markdown\n<!-- vale off -->\n```\n\n`<!-- vale off -->`\n\n<!-- Example vale off -->\n',
    );
    await Bun.write(join(sandbox.path, 'guide.mdx'), Bun.file(join(sandbox.path, 'guide.md')));
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'structure/suppressions', status: 'passed', findings: [] },
    ]);
    expect(await Bun.file(join(sandbox.path, 'query.sql')).text()).toBe('/* Explains the query. */\nSELECT 1;\n');
});

test.each(['-->', '--!>'])(
    'HTML suppression reasons exclude the %s terminator and still require a reason',
    async (ending) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'level = "all"\nconfigurations = ["html", "structure"]\n',
            'page.html': `<!-- html-validate-disable attr -- External validator owns this attribute. ${ending}\n<!-- html-validate-disable attr ${ending}\n`,
        });
        const session = await openSession(sandbox.path);
        const comments = await suppressionComments(
            session.root,
            session.scopes,
            session.reads,
            session.repository.files,
        );
        const reasonForm = session.manifests.get('html')!.tools.find((tool) => tool.name === 'html-validate')!
            .suppression!.reason;
        expect(comments).toStrictEqual([
            {
                file: 'page.html',
                line: 1,
                form: 'html-validate',
                reasonForm,
                forbidden: false,
                reason: 'External validator owns this attribute.',
            },
            { file: 'page.html', line: 2, form: 'html-validate', reasonForm, forbidden: false },
        ]);
        const result = await executeRun(
            session,
            buildRunOptions({ stage: 'commit', only: ['structure/suppressions'] }),
        );
        expect(result.report.exitCode).toBe(1);
        expect(
            result.report.checks.flatMap((check) => check.findings).map(({ file, line }) => ({ file, line })),
        ).toStrictEqual([{ file: 'page.html', line: 2 }]);
    },
);

test.each(['recommended', 'all'] as const)(
    'forbidden security suppressions fail at level %s and removing the marker clears the finding',
    async (level) => {
        await using sandbox = await testdir();
        const path = 'source.ts';
        const source = '// nosemgrep: example.rule -- The external interface requires this call.\nconst value = 1;\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['typescript', 'security'], { level }),
            [path]: source,
        });
        const failed = await executeRun(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['structure/suppressions'] }),
        );
        expect(failed.report.exitCode).toBe(1);
        expect(failed.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
            { file: path, line: 1, rule: 'semgrep' },
        ]);
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(source);
        const corrected = 'const value = 1;\n';
        await Bun.write(join(sandbox.path, path), corrected);
        const passed = await executeRun(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['structure/suppressions'] }),
        );
        expect(passed.report.exitCode).toBe(0);
        expect(passed.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(corrected);
    },
);

test('shared noqa text is attributed only to the tool that reads the file', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml':
            'level = "all"\nconfigurations = ["structure", "sql", "python"]\n[agent_rules]\nenabled = false\n',
        'query.sql': 'SELECT 1; -- noqa: LT01\n',
        'entry.py': 'answer = 1  # noqa: F841\n',
    });
    const result = await runGspot(directory.path, ['check', '--only', 'structure/suppressions', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const report = JSON.parse(result.stdout) as RunReport;
    expect(report.checks[0]!.findings).toStrictEqual(
        containingAll([
            containing({ file: 'query.sql', rule: 'sqlfluff-no-reason' }),
            containing({ file: 'entry.py', rule: 'ruff-no-reason' }),
        ]),
    );
    expect(report.checks[0]!.findings).toHaveLength(2);
});
