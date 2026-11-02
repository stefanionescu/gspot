import { testdir } from 'testdirs';
import { relative } from 'node:path';
import { test, expect } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { buildEslint } from '#tests/setup/eslint/lint.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

import {
    RUNTIME_CASES,
    RUNTIME_GLOBAL_FINDINGS,
    FRAMEWORK_RUNTIME_CASES,
    RUNTIME_OVERRIDE_TABLES,
    WINDOW_UNDEFINED_MESSAGE,
    PROCESS_UNDEFINED_MESSAGE,
    RUNTIME_OVERRIDE_SETTINGS,
} from '#tests/config/configurations/javascript/overrides.ts';

test.each([...RUNTIME_CASES])('runtime globals and Node.js rules stay apart ($runtime)', async (row) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            rules: true,
            tables: stringify({
                tools: { eslint: { override: [{ paths: ['application/**'], runtime: row.runtime }] } },
            }),
        }),
        'application/source.js': 'process.exit(0);\nBuffer.from("value");\n',
        'server.js': 'process.exit(0);\n',
    });

    const eslint = await buildEslint(sandbox.path);
    const [result] = await eslint.lintFiles(['application/source.js']);
    expect(result!.messages.map(({ ruleId, line }) => ({ ruleId, line }))).toStrictEqual([
        ...(row.runtime === 'react-native' ? [] : [{ ruleId: 'no-undef', line: 1 }]),
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
    expect(module!.messages.map(({ ruleId, line, message }) => ({ ruleId, line, message }))).toStrictEqual([
        { ruleId: 'no-undef', line: 1, message: "'__dirname' is not defined." },
    ]);
    const [required] = await eslint.lintFiles(['source.cjs']);
    expect(required!.messages).toStrictEqual([]);
});

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
    )) as { languageOptions: { sourceType: string } }[];
    expect(configs.map(({ languageOptions }) => languageOptions.sourceType)).toStrictEqual(['commonjs', 'module']);
});
