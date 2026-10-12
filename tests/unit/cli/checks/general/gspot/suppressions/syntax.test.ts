import { ESLint } from 'eslint';
import stylelint from 'stylelint';
import { HtmlValidate } from 'html-validate';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { buildCheckInput } from '#tests/setup/check-input.ts';
import { commentText, parseComments } from '#cli/parsers/comments.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { suppressions } from '#cli/checks/general/gspot/suppressions.ts';

import {
    JSX_COMMENTS,
    ESLINT_SUPPRESSIONS,
    QUOTED_ESLINT_COMMENTS,
    STYLELINT_SUPPRESSIONS,
    HTML_VALIDATE_SUPPRESSIONS,
} from '#tests/config/suppressions.ts';

const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: { rules: { 'no-console': 'error' } } });

const html = new HtmlValidate({ extends: ['html-validate:recommended'] });

describe.each([
    {
        name: 'ESLint',
        configuration: 'javascript',
        extension: 'js',
        form: 'eslint',
        rows: ESLINT_SUPPRESSIONS,
        body: 'console.log(1);',
        toolResult: async (source: string, path: string, active: boolean) => {
            const toolResult = await eslint.lintText(source, { filePath: path });
            expect(toolResult[0]!.suppressedMessages).toHaveLength(active ? 1 : 0);
        },
    },
    {
        name: 'Stylelint',
        configuration: 'css',
        extension: 'css',
        form: 'stylelint',
        rows: STYLELINT_SUPPRESSIONS,
        body: 'a { color: #ggg; }',
        toolResult: async (source: string, _path: string, active: boolean) => {
            const toolResult = await stylelint.lint({
                code: source,
                config: { rules: { 'color-no-invalid-hex': true } },
            });
            expect(toolResult.results[0]!.warnings).toHaveLength(active ? 0 : 1);
        },
    },
    {
        name: 'HTML Validate',
        configuration: 'html',
        extension: 'html',
        form: 'html-validate',
        rows: HTML_VALIDATE_SUPPRESSIONS,
        body: '\u003Cimg src="sample.png">',
        toolResult: async (source: string, _path: string, active: boolean) => {
            const toolResult = await html.validateString(source);
            const findings = toolResult.results.flatMap(({ messages }) =>
                messages.filter(({ ruleId }) => ruleId === 'wcag/h37'),
            );
            expect(findings).toHaveLength(active ? 0 : 1);
        },
    },
])('suppression comments match native $name', ({ configuration, extension, form, rows, body, toolResult }) => {
    const sources = rows.map(([comment, active], index) => ({
        comment,
        active,
        path: `source-${index.toString()}.${extension}`,
        source: `${comment}\n${body}\n`,
    }));
    let sandbox: Awaited<ReturnType<typeof testdir>>;
    let comments: Awaited<ReturnType<typeof suppressions>>;
    beforeAll(async () => {
        sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText([configuration], { level: 'all' }),
            ...Object.fromEntries(sources.map(({ path, source }) => [path, source])),
        });
        const session = await openSession(sandbox.path);
        comments = await suppressions(buildCheckInput(session, 'gspot/suppressions'));
    });
    afterAll(async () => {
        await sandbox[Symbol.asyncDispose]();
    });
    test.each([...sources])('recognizes $comment', async ({ active, path, source }) => {
        await toolResult(source, path, active);
        expect(comments.filter((entry) => entry.file === path).map(({ line, rule }) => ({ line, rule }))).toStrictEqual(
            active ? [{ line: 1, rule: `${form}-no-reason` }] : [],
        );
    });
});

test.each(['js', 'ts'])(
    'eslint comments inside strings and templates in .%s files are not directives',
    async (extension) => {
        await using sandbox = await testdir();
        const path = `source.${extension}`;
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['typescript', 'structure'], { level: 'all' }),
            [path]: QUOTED_ESLINT_COMMENTS,
        });
        const session = await openSession(sandbox.path);
        const comments = await suppressions(buildCheckInput(session, 'gspot/suppressions'));
        expect(comments.map(({ line, rule }) => ({ line, rule }))).toStrictEqual([
            { line: 1, rule: 'eslint-no-reason' },
            { line: 9, rule: 'eslint-no-reason' },
            { line: 10, rule: 'eslint-no-reason' },
        ]);
        const parsed = await parseComments(path, await Bun.file(`${sandbox.path}/${path}`).text());
        expect(
            parsed.flatMap(({ text, line }) => (/^(?:\/\/|#|--|<!--) ?marker:/u.test(commentText(text)) ? [line] : [])),
        ).toStrictEqual([12]);
    },
);

test('eslint comments in JSX text and quoted attributes are not directives; an empty expression comment is', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['typescript', 'structure'], { level: 'all' }),
        'source.tsx': JSX_COMMENTS,
    });
    const session = await openSession(sandbox.path);
    const comments = await suppressions(buildCheckInput(session, 'gspot/suppressions'));
    expect(comments.map(({ line, rule }) => ({ line, rule }))).toStrictEqual([
        { line: 3, rule: 'eslint-no-reason' },
        { line: 5, rule: 'eslint-no-reason' },
    ]);
});
