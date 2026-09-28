import stylelint from 'stylelint';
import { test, expect } from 'bun:test';
import { HtmlValidate } from 'html-validate';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { runBlocking } from '#cli/platform/spawn.ts';
import { openSession } from '#cli/execution/session.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { containing } from '#tests/support/expectations.ts';
import { suppressionComments } from '#cli/checks/repository/suppressions.ts';

test.each(['recommended', 'all'])('the CLI at %s requires reasons only for native directives', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nlevel = "${level}"\nrequire_reasons = true\nconfigurations = ["python", "css", "html", "structure"]\n`,
        'source.py': 'import os # NOQA: F401\nimport sys # ruff: noqa: F401\n',
        'source.css': '/* Example stylelint-disable */\na { color: #abc; }\n/*stylelint-disable*/\n',
        'source.html':
            '<!-- Example html-validate-disable wcag/h37 -->\n<!-- html-validate-disable wcag/h37 -->\n<img src="fixture.png">\n',
    });
    const checked = await run(sandbox.path, ['check', '--json', '--only', 'integrity/suppressions']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = reportSchema.parse(JSON.parse(checked.stdout));
    expect(report.checks.map(({ status }) => status)).toStrictEqual(['fail']);
    expect(
        report.checks.flatMap(({ findings }) => findings.map(({ file, line, rule }) => ({ file, line, rule }))),
    ).toStrictEqual([
        { file: 'source.css', line: 3, rule: 'stylelint-no-reason' },
        { file: 'source.html', line: 2, rule: 'html-validate-no-reason' },
        { file: 'source.py', line: 1, rule: 'ruff-no-reason' },
    ]);
});

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
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["css"]\n',
        'source.css': source,
    });
    const native = await stylelint.lint({ code: source, config: { rules: { 'color-no-invalid-hex': true } } });
    expect(native.results[0]!.warnings).toHaveLength(active ? 0 : 1);
    const session = await openSession(sandbox.path);
    const comments = await suppressionComments(
        session.root,
        session.scopes,
        session.observations,
        session.repository.files,
    );
    expect(comments.map(({ line, form }) => ({ line, form }))).toStrictEqual(
        active ? [{ line: 1, form: 'stylelint' }] : [],
    );
});

test.each([
    ['# noqa: F401', true],
    ['# NOQA: F401', true],
    ['# NoQa: F401', true],
    ['# Example noqa: F401', false],
    ['# Example # noqa: F401', true],
    ['# noqa-unknown: F401', false],
    ['# noqa: F401 # reason: External import.', true],
] as const)('suppression census agrees with Ruff for %s', async (comment, active) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["python"]\n',
        'source.py': `import os ${comment}\n`,
    });
    const native = runBlocking(
        ['ruff', 'check', '--isolated', '--select', 'F401', '--output-format', 'json', 'source.py'],
        {
            cwd: sandbox.path,
        },
    );
    expect(native.code, native.stderr).toBe(active ? 0 : 1);
    expect(JSON.parse(native.stdout)).toStrictEqual(active ? [] : [containing({ code: 'F401' })]);
    const session = await openSession(sandbox.path);
    const comments = await suppressionComments(
        session.root,
        session.scopes,
        session.observations,
        session.repository.files,
    );
    expect(comments.map(({ line, form }) => ({ line, form }))).toStrictEqual(active ? [{ line: 1, form: 'ruff' }] : []);
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
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["html"]\n',
        'source.html': source,
    });
    const validator = new HtmlValidate({ extends: ['html-validate:recommended'] });
    const native = await validator.validateString(source);
    const findings = native.results.flatMap(({ messages }) => messages.filter(({ ruleId }) => ruleId === 'wcag/h37'));
    expect(findings).toHaveLength(active ? 0 : 1);
    const session = await openSession(sandbox.path);
    const comments = await suppressionComments(
        session.root,
        session.scopes,
        session.observations,
        session.repository.files,
    );
    expect(comments.map(({ line, form }) => ({ line, form }))).toStrictEqual(
        active ? [{ line: 1, form: 'html-validate' }] : [],
    );
});

test.each([
    { name: 'file', source: '# ruff: noqa: F401\nimport os\n', suppressed: true, directive: true, line: 1 },
    { name: 'mixed case', source: '# ruff: NoQa: F401\nimport os\n', suppressed: true, directive: true, line: 1 },
    { name: 'flake8 file', source: '# flake8: noqa: F401\nimport os\n', suppressed: true, directive: true, line: 1 },
    {
        name: 'nested marker',
        source: '# Example # ruff: noqa: F401\nimport os\n',
        suppressed: true,
        directive: true,
        line: 1,
    },
    { name: 'inline file', source: 'import os # ruff: noqa: F401\n', suppressed: false, directive: false, line: 1 },
    {
        name: 'inline flake8 file',
        source: 'import os # flake8: noqa: F401\n',
        suppressed: false,
        directive: false,
        line: 1,
    },
    {
        name: 'uppercase prefix',
        source: '# RUFF: NOQA: F401\nimport os\n',
        suppressed: false,
        directive: false,
        line: 1,
    },
    { name: 'unused line', source: '# noqa: F401\nimport os\n', suppressed: false, directive: true, line: 1 },
    { name: 'wrong code', source: 'import os # noqa: F821\n', suppressed: false, directive: true, line: 1 },
])('the census respects placement for a Ruff $name directive', async ({ source, suppressed, directive, line }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["python"]\n',
        'source.py': source,
    });
    const native = runBlocking(
        ['ruff', 'check', '--isolated', '--select', 'F401', '--output-format', 'json', 'source.py'],
        { cwd: sandbox.path },
    );
    expect(native.code, native.stderr).toBe(suppressed ? 0 : 1);
    expect(JSON.parse(native.stdout)).toStrictEqual(suppressed ? [] : [containing({ code: 'F401' })]);
    const session = await openSession(sandbox.path);
    const comments = await suppressionComments(
        session.root,
        session.scopes,
        session.observations,
        session.repository.files,
    );
    expect(comments.map(({ line, form }) => ({ line, form }))).toStrictEqual(directive ? [{ line, form: 'ruff' }] : []);
});
