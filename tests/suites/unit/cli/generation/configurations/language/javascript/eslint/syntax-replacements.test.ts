import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { ESLINT_LEVEL_CASES } from '#tests/config/generation/configurations/language/javascript/eslint/replacements.ts';

test.each(ESLINT_LEVEL_CASES)(
    '%s preserves assignment, deletion, switch and static-property checks in %s',
    async (level, extension) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
            'package.json': '{"private":true,"type":"module"}',
            [`assignment.${extension}`]: 'send(value = read());',
            [`delete.${extension}`]: 'delete 42;',
            [`switch.${extension}`]: 'switch (value) { case 1: retry: while (ready) run(); }',
            [`static.${extension}`]: 'class Clock { static interval = 1000; }',
        });
        const eslint = await buildEslint(sandbox.path);
        const rules = [
            'no-restricted-syntax',
            'no-delete-var',
            'gspot/no-switch-case-labels',
            'gspot/prefer-readonly-static',
            'sonarjs/no-nested-assignment',
            'sonarjs/no-delete-var',
            'sonarjs/no-case-label-in-switch',
            'sonarjs/public-static-readonly',
        ];
        const files = ['assignment', 'delete', 'switch', 'static'].map((name) => `${name}.${extension}`);
        expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
            ...(level === 'all' ? [{ file: `assignment.${extension}`, rule: 'no-restricted-syntax', line: 1 }] : []),
            { file: `delete.${extension}`, rule: 'no-restricted-syntax', line: 1 },
            ...(level === 'all' && extension === 'ts'
                ? [{ file: 'static.ts', rule: 'gspot/prefer-readonly-static', line: 1 }]
                : []),
            { file: `switch.${extension}`, rule: 'gspot/no-switch-case-labels', line: 1 },
        ]);
        await createFileTree(sandbox.path, {
            [`assignment.${extension}`]: 'value = read(); send(value);',
            [`delete.${extension}`]: 'delete value.key;',
            [`switch.${extension}`]: 'switch (value) { case 1: while (ready) run(); }',
            [`static.${extension}`]:
                extension === 'ts'
                    ? 'class Clock { static readonly interval = 1000; }'
                    : 'class Clock { interval = 1000; }',
        });
        expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
    },
);

test.each(['js', 'ts'])('assignment selectors preserve their allowed parent contexts in %s', async (extension) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level: 'all' }),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'package.json': '{"private":true,"type":"module"}',
        [`contexts.${extension}`]: [
            'value = read();',
            'first = second = read();',
            'const result = value = read();',
            'if ((value = read()) !== null) run();',
            'for (; ready; count++, value = read()) run();',
            'const fetch = () => value = read();',
            'ready && (value = read());',
            'while (value = read()) run();',
            'do run(); while (value = read());',
            'for (value = read(); ready; value = read()) run();',
            'delete value?.key;',
        ].join('\n'),
    });
    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(eslint, sandbox.path, [`contexts.${extension}`], ['no-restricted-syntax']),
    ).toStrictEqual([]);
    await createFileTree(sandbox.path, {
        [`contexts.${extension}`]: [
            'call(value = read());',
            '1 + (value = read());',
            '(value = read()) || other;',
            'if (value = read()) run();',
            'for (; value = read(); count++) run();',
            'function read() { return value = fetch(); }',
            'delete read();',
        ].join('\n'),
    });
    expect(
        await listLintFindings(eslint, sandbox.path, [`contexts.${extension}`], ['no-restricted-syntax']),
    ).toStrictEqual(
        [1, 2, 3, 4, 5, 6, 7].map((line) => ({ file: `contexts.${extension}`, rule: 'no-restricted-syntax', line })),
    );
});

test.each(ESLINT_LEVEL_CASES)(
    '%s preserves switch size, thrown errors, operators and templates in %s',
    async (level, extension) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
            'package.json': '{"private":true,"type":"module"}',
            [`error.${extension}`]: 'new Error("Invalid value");',
            [`operator.${extension}`]: 'count =+ increment;',
            [`switch.${extension}`]: [
                'switch (value) {',
                ...Array.from({ length: 31 }, (_, index) => `case ${index.toString()}: break;`),
                '}',
            ].join(' '),
            [`template.${extension}`]: 'const text = `outer ${`inner ${value}`}`;',
        });
        const eslint = await buildEslint(sandbox.path);
        const rules = [
            'gspot/max-switch-cases',
            'gspot/no-unthrown-error',
            'gspot/no-transposed-assignment',
            'gspot/no-nested-template-literals',
            'sonarjs/max-switch-cases',
            'sonarjs/no-unthrown-error',
            'sonarjs/non-existent-operator',
            'sonarjs/no-nested-template-literals',
        ];
        const files = ['error', 'operator', 'switch', 'template'].map((name) => `${name}.${extension}`);
        expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
            { file: `error.${extension}`, rule: 'gspot/no-unthrown-error', line: 1 },
            { file: `operator.${extension}`, rule: 'gspot/no-transposed-assignment', line: 1 },
            ...(level === 'all'
                ? [
                      { file: `switch.${extension}`, rule: 'gspot/max-switch-cases', line: 1 },
                      { file: `template.${extension}`, rule: 'gspot/no-nested-template-literals', line: 1 },
                  ]
                : []),
        ]);
        await createFileTree(sandbox.path, {
            [`error.${extension}`]: 'throw new Error("Invalid value");',
            [`operator.${extension}`]: 'count += increment;',
            [`switch.${extension}`]: 'switch (value) { case 1: break; }',
            [`template.${extension}`]: 'const text = `outer ${value}`;',
        });
        expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
    },
);

test.each(ESLINT_LEVEL_CASES)(
    '%s preserves local function argument and return checks in %s',
    async (level, extension) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
            'package.json': '{"private":true,"type":"module"}',
            [`arguments.${extension}`]: 'function read(value) { return value; } read(1, ...values);',
            [`return.${extension}`]: 'function write() { save(); } const value = write();',
        });
        const eslint = await buildEslint(sandbox.path);
        const rules = [
            'gspot/no-excess-call-arguments',
            'gspot/no-empty-return-value',
            'sonarjs/no-extra-arguments',
            'sonarjs/no-use-of-empty-return-value',
        ];
        const files = [`arguments.${extension}`, `return.${extension}`];
        expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
            { file: `arguments.${extension}`, rule: 'gspot/no-excess-call-arguments', line: 1 },
            { file: `return.${extension}`, rule: 'gspot/no-empty-return-value', line: 1 },
        ]);
        await createFileTree(sandbox.path, {
            [`arguments.${extension}`]: 'function read(...values) { return values; } read(1, ...values);',
            [`return.${extension}`]: 'function write() { return save(); } const value = write();',
        });
        expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
    },
);

test.each(ESLINT_LEVEL_CASES)('%s preserves impossible collection-size checks in %s', async (level, extension) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'package.json': '{"private":true,"type":"module"}',
        [`collection.${extension}`]: 'const items = [1]; items.length < 0; const values = new Map(); values.size >= 0;',
        ...(extension === 'ts' ? { 'custom.ts': 'const metric = { size: -1 }; metric.size < 0;' } : {}),
    });
    const eslint = await buildEslint(sandbox.path);
    const rules = ['gspot/no-impossible-collection-size', 'sonarjs/no-collection-size-mischeck'];
    const files = [`collection.${extension}`, ...(extension === 'ts' ? ['custom.ts'] : [])];
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
        { file: `collection.${extension}`, rule: 'gspot/no-impossible-collection-size', line: 1 },
        { file: `collection.${extension}`, rule: 'gspot/no-impossible-collection-size', line: 1 },
    ]);
    await createFileTree(sandbox.path, {
        [`collection.${extension}`]:
            'const items = [1]; items.length === 0; const values = new Map(); values.size > 0;',
    });
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
});

test.each(ESLINT_LEVEL_CASES)(
    '%s checks fixed test waits in %s without a selected testing framework',
    async (level, extension) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
            'package.json': '{"private":true,"type":"module"}',
            [`page.test.${extension}`]: 'cy.wait(1000); page.waitForTimeout(1000);',
            [`page.${extension}`]: 'cy.wait(1000); page.waitForTimeout(1000);',
        });
        const eslint = await buildEslint(sandbox.path);
        const rules = ['gspot/no-fixed-test-waits', 'sonarjs/no-fixed-wait-in-tests'];
        const files = [`page.test.${extension}`, `page.${extension}`];
        expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
            { file: `page.test.${extension}`, rule: 'gspot/no-fixed-test-waits', line: 1 },
            { file: `page.test.${extension}`, rule: 'gspot/no-fixed-test-waits', line: 1 },
        ]);
        await createFileTree(sandbox.path, {
            [`page.test.${extension}`]: 'cy.wait("@request"); page.waitForSelector("button");',
        });
        expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
    },
);

test.each(ESLINT_LEVEL_CASES)('%s preserves unsafe loop closure detection in %s', async (level, extension) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'package.json': '{"private":true,"type":"module"}',
        [`loops.${extension}`]: [
            'for (var index = 0; index < 10; index++) callbacks.push(() => index);',
            'for (var value of values) callbacks.push(() => () => value);',
            'for (var current = 0; current < 10; current++) (() => current)();',
        ].join('\n'),
    });
    const eslint = await buildEslint(sandbox.path);
    const rules = ['no-loop-func', 'sonarjs/function-inside-loop'];
    expect(await listLintFindings(eslint, sandbox.path, [`loops.${extension}`], rules)).toStrictEqual([
        { file: `loops.${extension}`, rule: 'no-loop-func', line: 1 },
        { file: `loops.${extension}`, rule: 'no-loop-func', line: 2 },
    ]);
    await createFileTree(sandbox.path, {
        [`loops.${extension}`]: [
            'for (let index = 0; index < 10; index++) callbacks.push(() => index);',
            'for (const value of values) callbacks.push(() => () => value);',
        ].join('\n'),
    });
    expect(await listLintFindings(eslint, sandbox.path, [`loops.${extension}`], rules)).toStrictEqual([]);
});
