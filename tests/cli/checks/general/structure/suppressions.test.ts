import { ESLint } from 'eslint';
import { join } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { executeRun } from '#cli/execution/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { checkReport, buildRunOptions } from '#tests/harness/gspot.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { commentText, parseComments } from '#cli/parsers/source/public.ts';
import { containing, containingAll } from '#tests/harness/expectations.ts';
import { suppressionComments } from '#cli/checks/general/structure/public.ts';

import {
    SUPPRESSION_COMMENTS,
    SUPPRESSION_REASON_CASES,
} from '#tests/config/cli/checks/general/structure/suppressions.ts';

describe('suppression comments match native ESLint', () => {
    const sources = SUPPRESSION_COMMENTS.map(([comment, active], index) => ({
        comment,
        active,
        path: `source-${index.toString()}.js`,
        source: `${comment}\nconsole.log(1);\n`,
    }));
    let sandbox: Awaited<ReturnType<typeof testdir>>;
    let comments: Awaited<ReturnType<typeof suppressionComments>>;
    let eslint: ESLint;
    beforeAll(async () => {
        sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['javascript'], { level: 'all' }),
            ...Object.fromEntries(sources.map(({ path, source }) => [path, source])),
        });
        const session = await openSession(sandbox.path);
        comments = await suppressionComments(session.root, session.scopes, session.reads, session.repository.files);
        eslint = new ESLint({ overrideConfigFile: true, overrideConfig: { rules: { 'no-console': 'error' } } });
    });
    afterAll(async () => {
        await sandbox[Symbol.asyncDispose]();
    });
    test.each(sources)('recognizes $comment', async ({ active, path, source }) => {
        const native = await eslint.lintText(source, { filePath: path });
        expect(native[0]!.suppressedMessages).toHaveLength(active ? 1 : 0);
        expect(comments.filter((entry) => entry.file === path).map(({ line, form }) => ({ line, form }))).toStrictEqual(
            active ? [{ line: 1, form: 'eslint' }] : [],
        );
    });
});

test.each(SUPPRESSION_REASON_CASES)(
    'suppression reasons immediately above %s require an adjacent explanation comment',
    async (path, source, lines) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'level = "all"\nconfigurations = ["typescript", "bash"]\n',
            [path]: source,
        });
        const session = await openSession(sandbox.path);
        const result = await executeRun(session, buildRunOptions({ stage: 'commit', only: ['gspot/suppressions'] }));
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
    const command = ['check', '--only', 'gspot/suppressions', '--json'];
    await Bun.write(join(sandbox.path, 'guide.mdx'), Bun.file(join(sandbox.path, 'guide.md')));
    const failed = await checkReport(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks).toMatchObject([
        {
            check: 'gspot/suppressions',
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
    const corrected = await checkReport(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check: 'gspot/suppressions', status: 'passed', findings: [] }]);
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
        const result = await executeRun(session, buildRunOptions({ stage: 'commit', only: ['gspot/suppressions'] }));
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
            buildRunOptions({ only: ['gspot/suppressions'] }),
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
            buildRunOptions({ only: ['gspot/suppressions'] }),
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
    const result = await checkReport(directory.path, ['check', '--only', 'gspot/suppressions', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const report = result.report;
    expect(report.checks[0]!.findings).toStrictEqual(
        containingAll([
            containing({ file: 'query.sql', rule: 'sqlfluff-no-reason' }),
            containing({ file: 'entry.py', rule: 'ruff-no-reason' }),
        ]),
    );
    expect(report.checks[0]!.findings).toHaveLength(2);
});

test.each(['js', 'ts'])(
    'suppression comments in %s distinguish strings and templates from executable directives',
    async (extension) => {
        await using sandbox = await testdir();
        const path = `source.${extension}`;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['typescript', 'structure'], { level: 'all' }),
            [path]: [
                String.raw`const apostrophe = "I am Sid\'s example"; // eslint-disable-line no-console`,
                'const template = `',
                '// eslint-disable-next-line no-alert',
                '// marker: Sample text is not a directive.',
                '`;',
                'const ordinary = "// marker: This is sample text.";',
                '// eslint-disable-next-line no-alert -- reason: External callback owns this call.',
                'alert(ordinary);',
                'function empty() { /* eslint-disable no-console */ }',
                'const nested = `${(() => { // eslint-disable-line no-alert',
                'return 1; })()}`;',
                '// marker: Required external interface.',
                'const active = 1;',
            ].join('\n'),
        });
        const session = await openSession(sandbox.path);
        const comments = await suppressionComments(
            session.root,
            session.scopes,
            session.reads,
            session.repository.files,
        );
        expect(comments.map(({ line, form, reason }) => ({ line, form, reason }))).toStrictEqual([
            { line: 1, form: 'eslint', reason: undefined },
            { line: 7, form: 'eslint', reason: 'reason: External callback owns this call.' },
            { line: 9, form: 'eslint', reason: undefined },
            { line: 10, form: 'eslint', reason: undefined },
        ]);
        const parsed = await parseComments(path, await Bun.file(`${sandbox.path}/${path}`).text());
        expect(
            parsed.flatMap(({ text, line }) => (/^(?:\/\/|#|--|<!--) ?marker:/u.test(commentText(text)) ? [line] : [])),
        ).toStrictEqual([12]);
    },
);

test('JSX text and quoted attributes do not become directives, but an empty expression comment does', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript', 'structure'], { level: 'all' }),
        'source.tsx': [
            'const element = <div title="// eslint-disable no-alert">',
            '// eslint-disable no-console',
            '{/* eslint-disable no-debugger */}',
            '</div>;',
            '// eslint-disable-next-line no-alert',
            'alert(element);',
        ].join('\n'),
    });
    const session = await openSession(sandbox.path);
    const comments = await suppressionComments(session.root, session.scopes, session.reads, session.repository.files);
    expect(comments.map(({ line, form }) => ({ line, form }))).toStrictEqual([
        { line: 3, form: 'eslint' },
        { line: 5, form: 'eslint' },
    ]);
});
