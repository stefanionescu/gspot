import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { ESLINT_LEVEL_CASES } from '#tests/config/configurations/javascript/configuration-blocks.ts';

test.each(ESLINT_LEVEL_CASES)('%s preserves expression and return checks in %s', async (level, extension) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'package.json': '{"private":true,"type":"module"}',
        [`global.${extension}`]: 'this.name;',
        [`negated.${extension}`]: 'const left = 1; const right = 2; !(left < right);',
        [`operands.${extension}`]: 'read() - read();',
        [`return.${extension}`]: 'function valid() { if (check()) return true; else return true; }',
    });
    const eslint = await buildEslint(sandbox.path);
    const rules = [
        'gspot/no-global-this',
        'gspot/no-negated-comparison',
        'gspot/no-identical-operands',
        'gspot/prefer-boolean-return',
        'sonarjs/no-global-this',
        'sonarjs/no-inverted-boolean-check',
        'sonarjs/no-identical-expressions',
        'sonarjs/prefer-single-boolean-return',
    ];
    const files = ['global', 'negated', 'operands', 'return'].map((name) => `${name}.${extension}`);
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
        ...(level === 'all'
            ? [
                  { file: `global.${extension}`, rule: 'gspot/no-global-this', line: 1 },
                  { file: `negated.${extension}`, rule: 'gspot/no-negated-comparison', line: 1 },
              ]
            : []),
        { file: `operands.${extension}`, rule: 'gspot/no-identical-operands', line: 1 },
        ...(level === 'all' ? [{ file: `return.${extension}`, rule: 'gspot/prefer-boolean-return', line: 1 }] : []),
    ]);
    await createFileTree(sandbox.path, {
        [`global.${extension}`]: 'globalThis.name;',
        [`negated.${extension}`]: 'const left = 1; const right = 2; left >= right;',
        [`operands.${extension}`]: 'read() - previous();',
        [`return.${extension}`]: 'function valid() { check(); return true; }',
    });
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
});

test.each(ESLINT_LEVEL_CASES)(
    '%s preserves invalid literal calls and template tags in %s',
    async (level, extension) => {
        const expressions = ['[]', 'class {}', '{}', '42', '"text"', 'true', 'null', '/pattern/', '`text`'];
        const invalid = expressions.flatMap((expression) => [`(${expression})();`, `(${expression})\`text\`;`]);
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
            'package.json': '{"private":true,"type":"module"}',
            [`literal.${extension}`]: invalid.join('\n'),
        });
        const eslint = await buildEslint(sandbox.path);
        const rules = ['gspot/restricted-syntax', 'sonarjs/no-literal-call'];
        expect(await listLintFindings(eslint, sandbox.path, [`literal.${extension}`], rules)).toStrictEqual(
            invalid.map((_, index) => ({
                file: `literal.${extension}`,
                rule: 'gspot/restricted-syntax',
                line: index + 1,
            })),
        );
        await createFileTree(sandbox.path, {
            [`literal.${extension}`]: [
                '(function() {})();',
                '(() => {})();',
                'new (class {})();',
                'call();',
                'receiver.call();',
                'tag`text`;',
                '[call][0]();',
            ].join('\n'),
        });
        expect(await listLintFindings(eslint, sandbox.path, [`literal.${extension}`], rules)).toStrictEqual([]);
    },
);

test.each(ESLINT_LEVEL_CASES)('%s preserves executable and temporary-path checks in %s', async (level, extension) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'package.json': '{"private":true,"type":"module"}',
        [`command.${extension}`]: 'import { spawn } from "node:child_process"; spawn("git");',
        [`temporary.${extension}`]: 'const path = "/tmp/file"; process.env.TMPDIR;',
    });
    const eslint = await buildEslint(sandbox.path);
    const files = [`command.${extension}`, `temporary.${extension}`];
    const rules = [
        'gspot/no-path-command',
        'gspot/no-public-temporary-path',
        'sonarjs/no-os-command-from-path',
        'sonarjs/publicly-writable-directories',
    ];
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual(
        level === 'all'
            ? [
                  { file: `command.${extension}`, rule: 'gspot/no-path-command', line: 1 },
                  { file: `temporary.${extension}`, rule: 'gspot/no-public-temporary-path', line: 1 },
                  { file: `temporary.${extension}`, rule: 'gspot/no-public-temporary-path', line: 1 },
              ]
            : [],
    );
    await createFileTree(sandbox.path, {
        [`command.${extension}`]: 'import { spawn } from "node:child_process"; spawn("/usr/bin/git");',
        [`temporary.${extension}`]: 'const path = "/home/private/file"; process.env.HOME;',
    });
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
});

test.each(ESLINT_LEVEL_CASES)('%s preserves dynamic sanitizer bypass checks in %s', async (level, extension) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'package.json': '{"private":true,"type":"module"}',
        [`sanitizer.${extension}`]:
            'const options = { html: request.body }; sanitizer.bypassSecurityTrustHtml(options.html);',
    });
    const eslint = await buildEslint(sandbox.path);
    const files = [`sanitizer.${extension}`];
    const rules = ['gspot/no-unsafe-sanitizer-bypass', 'sonarjs/no-angular-bypass-sanitization'];
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
        { file: `sanitizer.${extension}`, rule: 'gspot/no-unsafe-sanitizer-bypass', line: 1 },
    ]);
    await createFileTree(sandbox.path, {
        [`sanitizer.${extension}`]:
            'const options = { html: "<strong>Trusted</strong>" }; sanitizer.bypassSecurityTrustHtml(options.html);',
    });
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
});

test.each(ESLINT_LEVEL_CASES)(
    '%s preserves boolean operands and combined case checks in %s',
    async (level, extension) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
            'package.json': '{"private":true,"type":"module"}',
            [`boolean.${extension}`]: 'const result = value && true;',
            [`case.${extension}`]: 'switch (value) { case first || second: break; }',
        });
        const eslint = await buildEslint(sandbox.path);
        const files = [`boolean.${extension}`, `case.${extension}`];
        const rules = [
            'gspot/no-redundant-boolean',
            'gspot/no-compound-case',
            'sonarjs/no-redundant-boolean',
            'sonarjs/comma-or-logical-or-case',
        ];
        expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
            { file: `boolean.${extension}`, rule: 'gspot/no-redundant-boolean', line: 1 },
            { file: `case.${extension}`, rule: 'gspot/no-compound-case', line: 1 },
        ]);
        await createFileTree(sandbox.path, {
            [`boolean.${extension}`]: 'const result = Boolean(value);',
            [`case.${extension}`]: 'switch (value) { case first: case second: break; }',
        });
        expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
    },
);

test.each(ESLINT_LEVEL_CASES)('%s preserves condition and call line boundaries in %s', async (level, extension) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'package.json': '{"private":true,"type":"module"}',
        [`call.${extension}`]: 'read // note\n(value);',
        [`condition.${extension}`]: 'if (first) {\n run();\n} if (second) run();',
        [`template.${extension}`]: 'tag // note\n`text`;',
    });
    const eslint = await buildEslint(sandbox.path);
    const files = ['call', 'condition', 'template'].map((name) => `${name}.${extension}`);
    const rules = [
        'gspot/no-detached-call',
        'gspot/no-adjacent-multiline-if',
        'sonarjs/call-argument-line',
        'sonarjs/no-same-line-conditional',
    ];
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
        { file: `call.${extension}`, rule: 'gspot/no-detached-call', line: 2 },
        ...(level === 'all'
            ? [{ file: `condition.${extension}`, rule: 'gspot/no-adjacent-multiline-if', line: 3 }]
            : []),
        { file: `template.${extension}`, rule: 'gspot/no-detached-call', line: 2 },
    ]);
    await createFileTree(sandbox.path, {
        [`call.${extension}`]: '// note\nread(value);',
        [`condition.${extension}`]: 'if (first) {\n run();\n}\nif (second) run();',
        [`template.${extension}`]: '// note\ntag`text`;',
    });
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
});

test.each(ESLINT_LEVEL_CASES)('%s preserves package entry-point imports in %s', async (level, extension) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'package.json': '{"private":true,"type":"module"}',
        [`imports.${extension}`]: 'import value from "./node_modules/example/private";',
        [`require.${extension}`]: 'const value = require("./node_modules/example/private");',
    });
    const eslint = await buildEslint(sandbox.path);
    const files = [`imports.${extension}`, `require.${extension}`];
    const rules = ['gspot/restricted-syntax', 'sonarjs/no-internal-api-use'];
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
        { file: `imports.${extension}`, rule: 'gspot/restricted-syntax', line: 1 },
        { file: `require.${extension}`, rule: 'gspot/restricted-syntax', line: 1 },
    ]);
    await createFileTree(sandbox.path, {
        [`imports.${extension}`]: 'import value from "example";',
        [`require.${extension}`]: 'const value = require("example");',
    });
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
});

test.each(ESLINT_LEVEL_CASES)('%s preserves reserved binding checks in %s', async (level, extension) => {
    const filename = extension === 'js' ? 'declarations.cjs' : 'declarations.ts';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'package.json': '{"private":true,"type":"module"}',
        [filename]: 'var package = "example";',
        ...(extension === 'ts' ? { 'type.ts': 'type interface = string;' } : {}),
    });
    const eslint = await buildEslint(sandbox.path);
    const files = [filename, ...(extension === 'ts' ? ['type.ts'] : [])];
    const rules = ['gspot/no-keyword-declarations', 'sonarjs/future-reserved-words'];
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
        { file: filename, rule: 'gspot/no-keyword-declarations', line: 1 },
        ...(extension === 'ts' ? [{ file: 'type.ts', rule: 'gspot/no-keyword-declarations', line: 1 }] : []),
    ]);
    await createFileTree(sandbox.path, {
        [filename]: 'const packageName = "example"; const options = { package: packageName };',
        ...(extension === 'ts' ? { 'type.ts': 'type Contract = string;' } : {}),
    });
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
});

test.each(ESLINT_LEVEL_CASES)('%s preserves ignored exception checks in %s', async (level, extension) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'package.json': '{"private":true,"type":"module"}',
        [`catch.${extension}`]: 'try { run(); finish(); } catch (error) { fallback(); }',
    });
    const eslint = await buildEslint(sandbox.path);
    const files = [`catch.${extension}`];
    const rules = ['gspot/no-ignored-catch', 'sonarjs/no-ignored-exceptions'];
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
        { file: `catch.${extension}`, rule: 'gspot/no-ignored-catch', line: 1 },
    ]);
    await createFileTree(sandbox.path, {
        [`catch.${extension}`]: 'try { run(); finish(); } catch (error) { report(error); }',
    });
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
});
