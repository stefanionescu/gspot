import { relative } from 'node:path';

import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { convertToPosixPath } from '#cli/system/paths.ts';
import {
    FRAMEWORK_RUNTIME_CASES,
    PROCESS_UNDEFINED_MESSAGE,
    RUNTIME_OVERRIDE_SETTINGS,
    RUNTIME_OVERRIDE_TABLES,
    WINDOW_UNDEFINED_MESSAGE,
} from '#tests/config/configurations/javascript/overrides.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint } from '#tests/setup/eslint/lint.ts';

test('a browser override gets no Node.js globals and no Node.js rules, and other files keep both', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            rules: true,
            tables: stringify({
                tools: { eslint: { override: [{ paths: ['application/**'], runtime: 'browser' }] } },
            }),
        }),
        'application/source.js': 'process.exit(0);\nBuffer.from("value");\n',
        'server.js': 'process.exit(0);\n',
    });

    const eslint = await buildEslint(sandbox.path);
    const [result] = await eslint.lintFiles(['application/source.js']);
    expect(result!.messages.map(({ ruleId, line }) => ({ ruleId, line }))).toStrictEqual([
        { ruleId: 'no-undef', line: 1 },
        { ruleId: 'unicorn/no-process-exit', line: 1 },
        { ruleId: 'no-undef', line: 2 },
    ]);
    const [server] = await eslint.lintFiles(['server.js']);
    expect(server!.messages.map(({ ruleId, line }) => ({ ruleId, line }))).toStrictEqual([
        { ruleId: 'n/no-process-exit', line: 1 },
    ]);
});

test('ES modules reject CommonJS globals and .cjs files keep CommonJS', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], { rules: true }),
        'source.mjs': 'export const folder = __dirname;\n',
        'source.cjs': 'module.exports = __dirname;\n',
    });

    const eslint = await buildEslint(sandbox.path);
    const [module] = await eslint.lintFiles(['source.mjs']);
    expect(module!.messages.map(({ ruleId, line }) => ({ ruleId, line }))).toStrictEqual([
        { ruleId: 'no-undef', line: 1 },
    ]);
    const [required] = await eslint.lintFiles(['source.cjs']);
    expect(required!.messages).toStrictEqual([]);
});

const RUNTIME_GLOBAL_FINDINGS = [
    { file: 'server.js', messages: [] },
    { file: 'native/src/source.js', messages: [{ ruleId: 'no-undef', line: 2, message: "'Buffer' is not defined." }] },
    {
        file: 'native/src/browser.js',
        messages: [
            { ruleId: 'no-undef', line: 2, message: "'__DEV__' is not defined." },
            { ruleId: 'no-undef', line: 3, message: PROCESS_UNDEFINED_MESSAGE },
        ],
    },
    { file: 'web/source.js', messages: [{ ruleId: 'no-undef', line: 2, message: PROCESS_UNDEFINED_MESSAGE }] },
    { file: 'native/scripts/build.js', messages: [] },
    { file: 'native/server/source.js', messages: [] },
    { file: 'web/scripts/build.js', messages: [] },
    {
        file: 'native/scripts/worker.js',
        messages: [{ ruleId: 'no-undef', line: 2, message: "'Buffer' is not defined." }],
    },
];

test('framework runtimes and your runtime settings stay inside their scopes', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], RUNTIME_OVERRIDE_SETTINGS),
        'server.js': 'Buffer.from("");\n',
        'native/src/source.js': '__DEV__;\nBuffer;\n',
        'native/src/browser.js': 'window;\n__DEV__;\nprocess;\n',
        'native/scripts/build.js': 'Buffer.from("");\n',
        'native/scripts/worker.js': 'DedicatedWorkerGlobalScope;\nBuffer;\n',
        'native/server/source.js': 'Buffer.from("");\n',
        'web/source.js': 'window;\nprocess;\n',
        'web/scripts/build.js': 'Buffer.from("");\n',
    });

    const eslint = await buildEslint(sandbox.path);
    const results = await eslint.lintFiles(RUNTIME_GLOBAL_FINDINGS.map(({ file }) => file));
    expect(
        results.map(({ filePath, messages }) => ({
            file: convertToPosixPath(relative(sandbox.path, filePath)),
            messages: messages
                .filter(({ ruleId }) => ruleId === 'no-undef' || ruleId === null)
                .map(({ ruleId, line, message }) => ({ ruleId, line, message })),
        })),
    ).toStrictEqual([...RUNTIME_GLOBAL_FINDINGS]);
});

test('a later [[tools.eslint.override]] runtime replaces an earlier one', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            rules: true,
            tables: stringify(RUNTIME_OVERRIDE_TABLES),
        }),
        'app.js': 'window.alert("value");\n',
        'worker.js': 'postMessage("value");\nwindow.alert("value");\n',
    });

    const eslint = await buildEslint(sandbox.path);
    const [browser] = await eslint.lintFiles(['app.js']);
    expect(browser!.messages.filter(({ ruleId }) => ruleId === 'no-undef')).toStrictEqual([]);
    const [worker] = await eslint.lintFiles(['worker.js']);
    const undefinedNames = worker!.messages.filter(({ ruleId }) => ruleId === 'no-undef');
    expect(undefinedNames.map(({ line, message }) => ({ line, message }))).toStrictEqual([
        { line: 2, message: WINDOW_UNDEFINED_MESSAGE },
    ]);
});

test.each([...FRAMEWORK_RUNTIME_CASES])(
    'framework presets keep no globals of another runtime ($configuration)',
    async (row) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([row.configuration], {
                rules: true,
                tables: stringify({ tools: { eslint: { override: [{ paths: ['src/**'], runtime: 'worker' }] } } }),
            }),
            [row.path]: row.source,
        });

        const eslint = await buildEslint(sandbox.path);
        const [result] = await eslint.lintFiles([row.path]);
        expect(
            result!.messages.filter(({ ruleId }) => ruleId === 'no-undef').map(({ message }) => message),
        ).toStrictEqual([WINDOW_UNDEFINED_MESSAGE, PROCESS_UNDEFINED_MESSAGE]);
    },
);

test('a typeless package lints its .js files as CommonJS and its .mjs files as a module', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'package.json': '{"private":true}\n',
        'server.js': '',
        'tool.mjs': '',
    });
    const eslint = await buildEslint(sandbox.path);
    const configs = (await Promise.all(
        ['server.js', 'tool.mjs'].map((path) => eslint.calculateConfigForFile(path)),
    )) as Array<{ languageOptions: { sourceType: string } }>;
    expect(configs.map(({ languageOptions }) => languageOptions.sourceType)).toStrictEqual(['commonjs', 'module']);
});

test('a Next.js page in a package without a type is a module', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'nextjs']),
        'package.json': '{"private":true}\n',
        'app/page.js': '',
    });
    const eslint = await buildEslint(sandbox.path);
    const config = (await eslint.calculateConfigForFile('app/page.js')) as {
        languageOptions: { sourceType: string };
    };
    expect(config.languageOptions.sourceType).toBe('module');
});
