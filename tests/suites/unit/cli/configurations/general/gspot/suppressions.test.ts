import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import type { Finding } from '#cli/types/engine/run.ts';
import {
    JSX_COMMENTS,
    LIMIT_SUPPRESSION_CASES,
    QUOTED_ESLINT_COMMENTS,
    SUPPRESSION_REASON_CASES,
    SUPPRESSION_REASONS,
    SUPPRESSION_SYNTAX_CASES,
} from '#tests/config/configurations/gspot.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each([...SUPPRESSION_REASONS])(
    'the $configuration suppression $bare needs a reason and passes with one',
    async ({ configuration, file, bare, explained, rule }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([configuration], { level: 'all' }),
            [file]: `${bare}\n${explained}\n`,
        });
        const findings = await runSandboxCheck(sandbox.path, 'gspot/suppressions');
        expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([{ file, line: 1, rule }]);
    },
);

test.each([...SUPPRESSION_REASON_CASES])('$name', async ({ path, source, findings }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'bash'], { level: 'all', rules: true }),
        [path]: source,
    });
    const found = await runSandboxCheck(sandbox.path, 'gspot/suppressions');
    expect(found.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual(
        findings.map((finding) => ({ file: path, ...finding })),
    );
});

test.each(['-->', '--!>'])('an HTML suppression that ends with %s still needs a reason', async (ending) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['html', 'structure'], { level: 'all', rules: true }),
        'page.html': `<!-- html-validate-disable attr -- External validator owns this attribute. ${ending}\n<!-- html-validate-disable attr ${ending}\n`,
    });
    const findings = await runSandboxCheck(sandbox.path, 'gspot/suppressions');
    expect(findings.map(({ file, line }) => ({ file, line }))).toStrictEqual([{ file: 'page.html', line: 2 }]);
});

test('a nosemgrep comment is reported even with a reason', async () => {
    const path = 'source.ts';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'security'], { level: 'all' }),
        [path]: '// nosemgrep: example.rule -- The external interface requires this call.\nconst value = 1;\n',
    });
    const failed = await runSandboxCheck(sandbox.path, 'gspot/suppressions');
    expect(failed.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: path, line: 1, rule: 'semgrep' },
    ]);
    await writeFile(join(sandbox.path, path), 'const value = 1;\n');
    expect(await runSandboxCheck(sandbox.path, 'gspot/suppressions')).toStrictEqual([]);
});

test('a reason in a suppression or in gspot.toml that a reader cannot look up is reported', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            ignore: { checks: ['javascript/eslint'], reason: 'Step 3.1 of the plan keeps this.' },
        }),
        'source.ts':
            '// eslint-disable-next-line no-console -- Read /Users/ada/notes.md for the reason.\nconsole.log(1);\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'gspot/suppressions');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'source.ts', rule: 'home-path' },
        { file: 'gspot.toml', rule: 'plan-step' },
    ]);
});

describe.each([...SUPPRESSION_SYNTAX_CASES])(
    'suppression comments match $name',
    ({ configuration, extension, form, rows, body }) => {
        const sources = rows.map(([comment, active], index) => ({
            comment,
            active,
            path: `source-${index.toString()}.${extension}`,
            source: `${comment}\n${body}\n`,
        }));
        const resources = new AsyncDisposableStack();
        let comments: readonly Finding[];
        beforeAll(async () => {
            const files = Object.fromEntries(sources.map(({ path, source }) => [path, source]));
            const settings = buildSandboxSettings([configuration], { level: 'all' });
            const sandbox = resources.use(await createGitSandbox({ 'gspot.toml': settings, ...files }));
            comments = await runSandboxCheck(sandbox.path, 'gspot/suppressions');
        });
        afterAll(async () => {
            await resources.disposeAsync();
        });
        test.each([...sources])('$comment is a suppression: $active', ({ active, path }) => {
            expect(
                comments.filter((comment) => comment.file === path).map(({ line, rule }) => ({ line, rule })),
            ).toStrictEqual(active ? [{ line: 1, rule: `${form}-no-reason` }] : []);
        });
    },
);

test('eslint comments inside strings and templates are not suppressions', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'structure'], { level: 'all' }),
        'source.ts': QUOTED_ESLINT_COMMENTS,
    });
    const comments = await runSandboxCheck(sandbox.path, 'gspot/suppressions');
    expect(comments.map(({ line, rule }) => ({ line, rule }))).toStrictEqual([
        { line: 1, rule: 'eslint-no-reason' },
        { line: 9, rule: 'eslint-no-reason' },
        { line: 10, rule: 'eslint-no-reason' },
    ]);
});

test('eslint comments in JSX text and quoted attributes are not directives; an empty expression comment is', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'structure'], { level: 'all' }),
        'source.tsx': JSX_COMMENTS,
    });

    const comments = await runSandboxCheck(sandbox.path, 'gspot/suppressions');
    expect(comments.map(({ line, rule }) => ({ line, rule }))).toStrictEqual([
        { line: 3, rule: 'eslint-no-reason' },
        { line: 5, rule: 'eslint-no-reason' },
    ]);
});

test.each([...LIMIT_SUPPRESSION_CASES])(
    '$configuration refuses a suppression of $name',
    async ({ configuration, file, directive, code, rule }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([configuration], { level: 'all' }),
            [file]: `${directive}\n${code}\n`,
        });
        const found = await runSandboxCheck(sandbox.path, 'gspot/suppressions');
        expect(found.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([{ file, line: 1, rule }]);
    },
);

test('a suppression comment for a tool that does not check the file is not reported', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash', 'python'], { level: 'all' }),
        'source.py': '# shellcheck disable=SC2086\nVALUE = 1\n',
        'source.sh': '# shellcheck disable=SC2086\necho $name\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'gspot/suppressions');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'source.sh', rule: 'shellcheck-no-reason' },
    ]);
});

test('a scope without javascript reads no eslint suppression', async () => {
    const source = '// eslint-disable-next-line no-console\nconsole.log(1);\n';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            tables: '[[scope]]\npath = "py"\nconfigurations = ["python"]\nremoved_configurations = { javascript = "Python owns this folder." }\n',
        }),
        'a.js': source,
        'py/a.js': source,
    });
    const findings = await runSandboxCheck(sandbox.path, 'gspot/suppressions');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'a.js', rule: 'eslint-no-reason' },
    ]);
});
