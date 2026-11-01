import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/manifests.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { ESLINT_LEVEL_CASES } from '#tests/config/configurations/javascript/configuration-blocks.ts';

test.each(ESLINT_LEVEL_CASES)(
    '%s reports scope, constant, generator, and nested-if mistakes in %s',
    async (level, extension) => {
        const rules = ['block-scoped-var', 'no-const-assign', 'require-yield', 'unicorn/no-lonely-if'];
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
            'package.json': '{"private":true,"type":"module"}',
            [`branches.${extension}`]:
                'export function read(value) { if (value) { if (value.ready) { return value; } } }',
            [`constant.${extension}`]: 'const value = 1; value = 2; export { value };',
            [`generator.${extension}`]: 'export function* values() { return 1; }',
            [`scope.${extension}`]: 'export function read() { if (true) { var value = 1; } return value; }',
        });
        const eslint = await buildEslint(sandbox.path);
        const files = [
            `branches.${extension}`,
            `constant.${extension}`,
            `generator.${extension}`,
            `scope.${extension}`,
        ];
        expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
            { file: `branches.${extension}`, rule: 'unicorn/no-lonely-if', line: 1 },
            { file: `constant.${extension}`, rule: 'no-const-assign', line: 1 },
            { file: `generator.${extension}`, rule: 'require-yield', line: 1 },
            { file: `scope.${extension}`, rule: 'block-scoped-var', line: 1 },
        ]);
        await createFileTree(sandbox.path, {
            [`branches.${extension}`]: 'export function read(value) { if (value && value.ready) { return value; } }',
            [`constant.${extension}`]: 'export const value = 2;',
            [`generator.${extension}`]: 'export function* values() { yield 1; }',
            [`scope.${extension}`]: 'export function read() { let value; if (true) { value = 1; } return value; }',
        });
        expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
    },
);

test.each([...LEVELS])('%s lints a JavaScript class, which the default parser gives no decorators', async (level) => {
    const rules = ['gspot/no-trivial-functions', 'gspot/no-vue-class-components'];
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level }),
        'package.json': '{"private":true,"type":"module"}',
        'clock.js': 'export class Clock {\n    read() {\n        return 1;\n    }\n}\n',
    });
    const eslint = await buildEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['clock.js'], rules)).toStrictEqual(
        level === 'all' ? [{ file: 'clock.js', rule: 'gspot/no-trivial-functions', line: 2 }] : [],
    );
});

test.each(ESLINT_LEVEL_CASES)('%s runs the style rules at their level in %s', async (level, extension) => {
    const rules = ['no-labels', 'no-new', 'no-nested-ternary', 'default-case-last', 'no-void'];
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'package.json': '{"private":true,"type":"module"}',
        [`constructor.${extension}`]: 'new Date();',
        [`default.${extension}`]: 'switch (value) { default: run(); break; case 1: finish(); break; }',
        [`label.${extension}`]: 'outer: while (ready) { run(); }',
        [`ternary.${extension}`]: 'export const value = first ? 1 : second ? 2 : 3;',
        [`void.${extension}`]: 'export const ignored = void input;',
    });
    const eslint = await buildEslint(sandbox.path);
    const files = ['constructor', 'default', 'label', 'ternary', 'void'].map((name) => `${name}.${extension}`);
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
        ...(level === 'all'
            ? [
                  { file: `constructor.${extension}`, rule: 'no-new', line: 1 },
                  { file: `default.${extension}`, rule: 'default-case-last', line: 1 },
                  { file: `label.${extension}`, rule: 'no-labels', line: 1 },
                  { file: `ternary.${extension}`, rule: 'no-nested-ternary', line: 1 },
              ]
            : []),
        { file: `void.${extension}`, rule: 'no-void', line: 1 },
    ]);
    await createFileTree(sandbox.path, {
        [`constructor.${extension}`]: 'export const today = new Date();',
        [`default.${extension}`]: 'switch (value) { case 1: finish(); break; default: run(); break; }',
        [`label.${extension}`]: 'while (ready) { run(); }',
        [`ternary.${extension}`]: 'export const value = first ? 1 : 2;',
        [`void.${extension}`]: 'export const ignored = undefined;',
    });
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
});

test.each(ESLINT_LEVEL_CASES)(
    '%s reports Express header protection in %s without requiring the Express configuration',
    async (level, extension) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
            'package.json': '{"private":true,"type":"module"}',
            [`server.${extension}`]: 'import express from "express"; export const app = express();',
        });
        const eslint = await buildEslint(sandbox.path);
        const rules = ['gspot/no-powered-by-header'];
        expect(await listLintFindings(eslint, sandbox.path, [`server.${extension}`], rules)).toStrictEqual([
            { file: `server.${extension}`, rule: 'gspot/no-powered-by-header', line: 1 },
        ]);
        await createFileTree(sandbox.path, {
            [`server.${extension}`]:
                'import express from "express"; export const app = express(); app.disable("x-powered-by");',
        });
        expect(await listLintFindings(eslint, sandbox.path, [`server.${extension}`], rules)).toStrictEqual([]);
    },
);

test.each(ESLINT_LEVEL_CASES)('%s reports label targets and while-loop candidates in %s', async (level, extension) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'package.json': '{"private":true,"type":"module"}',
        [`label.${extension}`]: 'outer: { run(); }',
        [`loop.${extension}`]: 'for (; ready; ) run();',
        [`allowed.${extension}`]:
            'outer: while (ready) run(); doLoop: do { run(); } while (ready); forLoop: for (let i = 0; ready; i++) run(); inLoop: for (const key in value) run(); ofLoop: for (const item of values) run(); switchLabel: switch (value) { case 1: run(); } for (;;) break; for (let i = 0; ready;) run(); for (;ready;i++) run();',
    });
    const eslint = await buildEslint(sandbox.path);
    const files = ['label', 'loop', 'allowed'].map((name) => `${name}.${extension}`);
    const rules = ['gspot/restricted-syntax'];
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
        { file: `label.${extension}`, rule: 'gspot/restricted-syntax', line: 1 },
        ...(level === 'all' ? [{ file: `loop.${extension}`, rule: 'gspot/restricted-syntax', line: 1 }] : []),
    ]);
    await createFileTree(sandbox.path, {
        [`label.${extension}`]: 'run();',
        [`loop.${extension}`]: 'while (ready) run();',
    });
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
});

test.each(ESLINT_LEVEL_CASES)('%s reports cryptographic randomness enforcement in %s', async (level, extension) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'package.json': '{"private":true,"type":"module"}',
        [`random.${extension}`]: 'const draw = Math.random; export const token = draw();',
        [`shadow.${extension}`]: 'export function draw(Math) { return Math.random(); }',
    });
    const eslint = await buildEslint(sandbox.path);
    const rules = ['gspot/no-insecure-random'];
    const files = [`random.${extension}`, `shadow.${extension}`];
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
        { file: `random.${extension}`, rule: 'gspot/no-insecure-random', line: 1 },
    ]);
    await createFileTree(sandbox.path, { [`random.${extension}`]: 'export const token = crypto.randomUUID();' });
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
});

test.each(ESLINT_LEVEL_CASES)(
    '%s runs the commented-code, switch, literal, return, and alias rules in %s',
    async (level, extension) => {
        const names = [
            'no-commented-code',
            'no-nested-switch',
            'prefer-object-literal',
            'prefer-immediate-return',
            'redundant-type-aliases',
        ];
        const rules = names.map((name) => `gspot/${name}`);
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
            'package.json': '{"private":true,"type":"module"}',
            [`comment.${extension}`]: '// const user = readUser();',
            [`literal.${extension}`]: 'const user = {}; user.name = readName();',
            [`return.${extension}`]: 'export function read() { const value = fetch(); return value; }',
            [`switch.${extension}`]: 'switch (kind) { case "x": switch (state) { case 1: run(); } }',
            ...(extension === 'ts' ? { 'alias.ts': 'type Alias = string;' } : {}),
        });
        const eslint = await buildEslint(sandbox.path);
        const files = ['comment', 'literal', 'return', 'switch'].map((name) => `${name}.${extension}`);
        if (extension === 'ts') files.push('alias.ts');
        expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
            ...(extension === 'ts' ? [{ file: 'alias.ts', rule: 'gspot/redundant-type-aliases', line: 1 }] : []),
            ...(level === 'all'
                ? [
                      { file: `comment.${extension}`, rule: 'gspot/no-commented-code', line: 1 },
                      { file: `literal.${extension}`, rule: 'gspot/prefer-object-literal', line: 1 },
                      { file: `return.${extension}`, rule: 'gspot/prefer-immediate-return', line: 1 },
                      { file: `switch.${extension}`, rule: 'gspot/no-nested-switch', line: 1 },
                  ]
                : []),
        ]);
        await createFileTree(sandbox.path, {
            [`comment.${extension}`]: '// Read the user before sending the response.',
            [`literal.${extension}`]: 'const user = { name: readName() };',
            [`return.${extension}`]: 'export function read() { return fetch(); }',
            [`switch.${extension}`]: 'switch (kind) { case "x": run(); }',
            ...(extension === 'ts' ? { 'alias.ts': 'type Alias = "ready" | "waiting";' } : {}),
        });
        expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
    },
);

test.each(ESLINT_LEVEL_CASES)('%s reports Helmet and cookie protections in %s', async (level, extension) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'package.json': '{"private":true,"type":"module"}',
        [`headers.${extension}`]:
            'import express from "express"; import helmet from "helmet"; const app = express(); app.use(helmet({ contentSecurityPolicy: false, noSniff: false, referrerPolicy: false, hsts: false }));',
        [`cookies.${extension}`]: 'import session from "cookie-session"; session({ secure: false, httpOnly: false });',
    });
    const eslint = await buildEslint(sandbox.path);
    const files = [`headers.${extension}`, `cookies.${extension}`];
    const rules = ['gspot/no-unsafe-security-headers', 'gspot/no-insecure-cookies'];
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
        { file: `cookies.${extension}`, rule: 'gspot/no-insecure-cookies', line: 1 },
        { file: `cookies.${extension}`, rule: 'gspot/no-insecure-cookies', line: 1 },
        { file: `headers.${extension}`, rule: 'gspot/no-unsafe-security-headers', line: 1 },
        { file: `headers.${extension}`, rule: 'gspot/no-unsafe-security-headers', line: 1 },
        { file: `headers.${extension}`, rule: 'gspot/no-unsafe-security-headers', line: 1 },
        { file: `headers.${extension}`, rule: 'gspot/no-unsafe-security-headers', line: 1 },
    ]);
    await createFileTree(sandbox.path, {
        [`headers.${extension}`]:
            'import express from "express"; import helmet from "helmet"; const app = express(); app.use(helmet());',
        [`cookies.${extension}`]: 'import session from "cookie-session"; session({ secure: true, httpOnly: true });',
    });
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
});
