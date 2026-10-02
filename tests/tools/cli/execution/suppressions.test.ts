import stylelint from 'stylelint';
import { basename } from 'node:path';
import { test, expect } from 'bun:test';
import { HtmlValidate } from 'html-validate';
import { testdir, createFileTree } from 'testdirs';
import { runBlocking } from '#cli/platform/spawn.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { suppressionComments } from '#cli/checks/general/structure/suppressions.ts';

test.each([
    ['/* stylelint-disable color-no-invalid-hex */', true],
    ['/*stylelint-disable*/', true],
    ['/* stylelint-disable-next-line color-no-invalid-hex */', true],
    ['/* Example stylelint-disable color-no-invalid-hex */', false],
    ['/* stylelint-disable-unknown color-no-invalid-hex */', false],
    ['/*\n stylelint-disable color-no-invalid-hex\n*/', true],
    ['/**\n * stylelint-disable color-no-invalid-hex\n */', false],
    ['/* STYLELINT-DISABLE color-no-invalid-hex */', false],
] as const)('suppression census agrees with Stylelint for %s', async (comment, active) => {
    await using sandbox = await testdir();
    const source = `${comment}\na { color: #ggg; }\n`;
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['css'], '', 'all'),
        'source.css': source,
    });
    const native = await stylelint.lint({ code: source, config: { rules: { 'color-no-invalid-hex': true } } });
    expect(native.results[0]!.warnings).toHaveLength(active ? 0 : 1);
    const session = await openSession(sandbox.path);
    const comments = await suppressionComments(session.root, session.scopes, session.reads, session.repository.files);
    expect(comments.map(({ line, form }) => ({ line, form }))).toStrictEqual(
        active ? [{ line: 1, form: 'stylelint' }] : [],
    );
});

test.each([
    ['<!-- html-validate-disable wcag/h37 -->', true],
    ['<!-- html-validate-disable-next wcag/h37 -->', true],
    ['<!-- Example html-validate-disable wcag/h37 -->', false],
    ['<!-- html-validate-disable-unknown wcag/h37 -->', false],
    ['<!--html-validate-disable wcag/h37-->', true],
    ['<!--\nhtml-validate-disable wcag/h37\n-->', true],
    ['<!-- [html-validate-disable wcag/h37] -->', true],
] as const)('suppression census agrees with HTML Validate for %s', async (comment, active) => {
    await using sandbox = await testdir();
    const source = `${comment}\n<img src="fixture.png">\n`;
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['html'], '', 'all'),
        'source.html': source,
    });
    const validator = new HtmlValidate({ extends: ['html-validate:recommended'] });
    const native = await validator.validateString(source);
    const findings = native.results.flatMap(({ messages }) => messages.filter(({ ruleId }) => ruleId === 'wcag/h37'));
    expect(findings).toHaveLength(active ? 0 : 1);
    const session = await openSession(sandbox.path);
    const comments = await suppressionComments(session.root, session.scopes, session.reads, session.repository.files);
    expect(comments.map(({ line, form }) => ({ line, form }))).toStrictEqual(
        active ? [{ line: 1, form: 'html-validate' }] : [],
    );
});

// Each Ruff directive, whether Ruff honors it for F401, and whether gspot records it as a directive on line 1.
const RUFF_DIRECTIVES = [
    { source: 'import os # noqa: F401\n', suppressed: true, directive: true },
    { source: 'import os # NOQA: F401\n', suppressed: true, directive: true },
    { source: 'import os # NoQa: F401\n', suppressed: true, directive: true },
    { source: 'import os # Example noqa: F401\n', suppressed: false, directive: false },
    { source: 'import os # Example # noqa: F401\n', suppressed: true, directive: true },
    { source: 'import os # noqa-unknown: F401\n', suppressed: false, directive: false },
    { source: 'import os # noqa: F401 # reason: External import.\n', suppressed: true, directive: true },
    { source: '# ruff: noqa: F401\nimport os\n', suppressed: true, directive: true },
    { source: '# ruff: NoQa: F401\nimport os\n', suppressed: true, directive: true },
    { source: '# flake8: noqa: F401\nimport os\n', suppressed: true, directive: true },
    { source: '# Example # ruff: noqa: F401\nimport os\n', suppressed: true, directive: true },
    { source: 'import os # ruff: noqa: F401\n', suppressed: false, directive: false },
    { source: 'import os # flake8: noqa: F401\n', suppressed: false, directive: false },
    { source: '# RUFF: NOQA: F401\nimport os\n', suppressed: false, directive: false },
    { source: '# noqa: F401\nimport os\n', suppressed: false, directive: true },
    { source: 'import os # noqa: F821\n', suppressed: false, directive: true },
];

test('the census agrees with Ruff on every directive form and placement', async () => {
    await using sandbox = await testdir();
    const paths = RUFF_DIRECTIVES.map((_, index) => `source_${String(index)}.py`);
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['python'], '', 'all'),
        ...Object.fromEntries(RUFF_DIRECTIVES.map(({ source }, index) => [paths[index]!, source])),
    });
    const native = runBlocking(
        ['ruff', 'check', '--isolated', '--select', 'F401', '--output-format', 'json', ...paths],
        { cwd: sandbox.path },
    );
    const reported = new Set(
        (JSON.parse(native.stdout) as { filename: string }[]).map(({ filename }) => basename(filename)),
    );
    const session = await openSession(sandbox.path);
    const comments = await suppressionComments(session.root, session.scopes, session.reads, session.repository.files);
    expect(
        paths.map((path) => ({
            path,
            suppressed: !reported.has(path),
            directives: comments.filter((comment) => comment.file === path).map(({ line, form }) => ({ line, form })),
        })),
    ).toStrictEqual(
        RUFF_DIRECTIVES.map(({ suppressed, directive }, index) => ({
            path: paths[index]!,
            suppressed,
            directives: directive ? [{ line: 1, form: 'ruff' }] : [],
        })),
    );
});
