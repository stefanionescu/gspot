import { testdir } from 'testdirs';
import { relative } from 'node:path';
import { test, expect } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { createEslint } from '#tests/setup/eslint/lint.ts';
import type { EslintConfiguration } from '#tests/types/tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

import {
    RUNTIME_CASES,
    RUNTIME_GLOBAL_FINDINGS,
    FRAMEWORK_RUNTIME_CASES,
    RUNTIME_OVERRIDE_TABLES,
    RUNTIME_OVERRIDE_SETTINGS,
} from '#tests/config/generation/configurations/language/javascript/eslint/runtimes.ts';

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

    const eslint = await createEslint(sandbox.path);
    const config = (await eslint.calculateConfigForFile('application/source.js')) as EslintConfiguration;
    const globals = Object.keys(config.languageOptions.globals);
    expect(row.globals.filter((name) => !globals.includes(name))).toStrictEqual([]);
    expect(row.absent.filter((name) => globals.includes(name))).toStrictEqual([]);
    expect(Object.keys(config.rules).filter((name) => name.startsWith('n/'))).toStrictEqual([
        'n/file-extension-in-import',
    ]);
    const [result] = await eslint.lintFiles(['application/source.js']);
    expect(result!.messages.map(({ ruleId, line, message }) => ({ ruleId, line, message }))).toStrictEqual([
        ...(globals.includes('process') ? [] : [{ ruleId: 'no-undef', line: 1, message: "'process' is not defined." }]),
        {
            ruleId: 'unicorn/no-process-exit',
            line: 1,
            message: 'Only use `process.exit()` in CLI apps. Throw an error instead.',
        },
        { ruleId: 'no-undef', line: 2, message: "'Buffer' is not defined." },
    ]);
    const [server] = await eslint.lintFiles(['server.js']);
    expect(server!.messages.map(({ ruleId, line, message }) => ({ ruleId, line, message }))).toStrictEqual([
        { ruleId: 'n/no-process-exit', line: 1, message: "Don't use process.exit(); throw an error instead." },
    ]);
});

test('ES modules reject CommonJS globals and .cjs files keep CommonJS', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], { rules: true }),
        'source.mjs': 'export const folder = __dirname;\n',
        'source.cjs': 'module.exports = __dirname;\n',
    });

    const eslint = await createEslint(sandbox.path);
    const [module] = await eslint.lintFiles(['source.mjs']);
    expect(module!.messages.map(({ ruleId, line, message }) => ({ ruleId, line, message }))).toStrictEqual([
        { ruleId: 'no-undef', line: 1, message: "'__dirname' is not defined." },
    ]);
    const commonjs = (await eslint.calculateConfigForFile('source.cjs')) as EslintConfiguration;
    expect(commonjs.languageOptions.sourceType).toBe('commonjs');
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

    const eslint = await createEslint(sandbox.path);
    const node = (await eslint.calculateConfigForFile('server.js')) as EslintConfiguration;
    const native = (await eslint.calculateConfigForFile('native/src/source.js')) as EslintConfiguration;
    const browser = (await eslint.calculateConfigForFile('native/src/browser.js')) as EslintConfiguration;
    const web = (await eslint.calculateConfigForFile('web/source.js')) as EslintConfiguration;
    expect(node.languageOptions.globals['Buffer']).toBe(false);
    expect(native.languageOptions.globals['__DEV__']).toBe(false);
    expect(native.languageOptions.globals['Buffer']).toBeUndefined();
    expect(browser.languageOptions.globals['window']).toBe(false);
    expect(browser.languageOptions.globals['__DEV__']).toBeUndefined();
    expect(browser.languageOptions.globals['process']).toBeUndefined();
    expect(web.languageOptions.globals['window']).toBe(false);
    expect(web.languageOptions.globals['process']).toBeUndefined();
    for (const file of ['native/scripts/build.js', 'native/server/source.js', 'web/scripts/build.js']) {
        const script = (await eslint.calculateConfigForFile(file)) as EslintConfiguration;
        expect(script.languageOptions.globals['Buffer'], file).toBe(false);
        expect(script.rules['n/no-deprecated-api']![0]).toBe(2);
    }
    const worker = (await eslint.calculateConfigForFile('native/scripts/worker.js')) as EslintConfiguration;
    expect(worker.languageOptions.globals['DedicatedWorkerGlobalScope']).toBe(false);
    expect(worker.languageOptions.globals['Buffer']).toBeUndefined();
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

    const eslint = await createEslint(sandbox.path);
    const [browser] = await eslint.lintFiles(['app.js']);
    expect(browser!.messages).toStrictEqual([]);
    const [worker] = await eslint.lintFiles(['worker.js']);
    expect(worker!.messages.map(({ ruleId, line, message }) => ({ ruleId, line, message }))).toStrictEqual([
        { ruleId: 'no-undef', line: 2, message: "'window' is not defined." },
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

        const eslint = await createEslint(sandbox.path);
        const [result] = await eslint.lintFiles([row.path]);
        expect(
            result!.messages.filter(({ ruleId }) => ruleId === 'no-undef').map(({ message }) => message),
        ).toStrictEqual(["'window' is not defined.", "'process' is not defined."]);
    },
);
