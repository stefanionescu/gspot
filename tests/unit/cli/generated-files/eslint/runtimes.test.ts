import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { matchFields } from '#tests/setup/matchers.ts';
import { createEslint } from '#tests/setup/tool-files.ts';
import type { EslintConfiguration } from '#tests/types/tool-output.ts';
import { RUNTIME_CASES, FRAMEWORK_RUNTIME_CASES } from '#tests/data/generated-files/eslint/overrides.ts';

test.each([...RUNTIME_CASES])('runtime globals and Node.js rules stay apart: %j', async (entry) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            level: 'all',
            configurations: ['javascript'],
            tools: { eslint: { override: [{ paths: ['application/**'], runtime: entry.runtime }] } },
        }),
        'application/source.js': 'process.exit(0);\nBuffer.from("value");\n',
        'server.js': 'process.exit(0);\n',
    });
    const eslint = await createEslint(sandbox.path);
    const computed = (await eslint.calculateConfigForFile('application/source.js')) as EslintConfiguration;
    for (const name of entry.globals) expect(computed.languageOptions.globals[name]).toBeDefined();
    for (const name of entry.absent) expect(computed.languageOptions.globals[name]).toBeUndefined();
    expect(Object.keys(computed.rules).filter((name) => name.startsWith('n/'))).toStrictEqual([
        'n/file-extension-in-import',
    ]);
    const [result] = await eslint.lintFiles(['application/source.js']);
    expect(result!.messages.some(({ ruleId }) => ruleId === 'n/no-process-exit')).toBe(false);
    expect(
        result!.messages.find(({ ruleId, message }) => ruleId === 'no-undef' && message === "'Buffer' is not defined."),
    ).toBeDefined();
    const [server] = await eslint.lintFiles(['server.js']);
    expect(server!.messages.some(({ ruleId }) => ruleId === 'n/no-process-exit')).toBe(true);
});

test('ES modules reject CommonJS globals and .cjs files keep CommonJS', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'configurations = ["javascript"]\n',
        'source.mjs': 'export const folder = __dirname;\n',
        'source.cjs': 'module.exports = __dirname;\n',
    });
    const eslint = await createEslint(sandbox.path);
    const [module] = await eslint.lintFiles(['source.mjs']);
    expect(module!.messages).toContainEqual(
        matchFields({ ruleId: 'no-undef', message: "'__dirname' is not defined." }),
    );
    const commonjs = (await eslint.calculateConfigForFile('source.cjs')) as EslintConfiguration;
    expect(commonjs.languageOptions.sourceType).toBe('commonjs');
    const [required] = await eslint.lintFiles(['source.cjs']);
    expect(required!.messages.some(({ ruleId }) => ruleId === 'no-undef')).toBe(false);
});

test('framework runtimes and your runtime settings stay inside their scopes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'configurations = [ "javascript" ]\n\n[[scope]]\npath = "native"\nconfigurations = [ "react-native" ]\n\n[[scope]]\npath = "web"\nconfigurations = [ "react" ]\n\n[[scope]]\npath = "native/server"\nconfigurations = [ "javascript" ]\n\n[[tools.eslint.override]]\npaths = [ "native/src/browser.js" ]\nruntime = "browser"\n\n[[tools.eslint.override]]\npaths = [ "native/scripts/worker.js" ]\nruntime = "worker"\n\n[[tools.eslint.override]]\npaths = [ "native/server/**/*" ]\nruntime = "node"\n',
        'server.js': 'export const value = 1;\n',
        'native/src/source.js': 'export const value = 1;\n',
        'native/src/browser.js': 'export const value = 1;\n',
        'native/scripts/build.js': 'export const value = 1;\n',
        'native/scripts/worker.js': 'export const value = 1;\n',
        'native/server/source.js': 'export const value = 1;\n',
        'web/source.js': 'export const value = 1;\n',
        'web/scripts/build.js': 'export const value = 1;\n',
    });
    const eslint = await createEslint(sandbox.path);
    const node = (await eslint.calculateConfigForFile('server.js')) as EslintConfiguration;
    const native = (await eslint.calculateConfigForFile('native/src/source.js')) as EslintConfiguration;
    const browser = (await eslint.calculateConfigForFile('native/src/browser.js')) as EslintConfiguration;
    const web = (await eslint.calculateConfigForFile('web/source.js')) as EslintConfiguration;
    expect(node.languageOptions.globals['Buffer']).toBeDefined();
    expect(native.languageOptions.globals['__DEV__']).toBeDefined();
    expect(native.languageOptions.globals['Buffer']).toBeUndefined();
    expect(browser.languageOptions.globals['window']).toBeDefined();
    expect(browser.languageOptions.globals['__DEV__']).toBeUndefined();
    expect(browser.languageOptions.globals['process']).toBeUndefined();
    expect(web.languageOptions.globals['window']).toBeDefined();
    expect(web.languageOptions.globals['process']).toBeUndefined();
    for (const file of ['native/scripts/build.js', 'native/server/source.js', 'web/scripts/build.js']) {
        const script = (await eslint.calculateConfigForFile(file)) as EslintConfiguration;
        expect(script.languageOptions.globals['Buffer'], file).toBeDefined();
        expect(script.rules['n/no-deprecated-api']![0]).toBe(2);
    }
    const worker = (await eslint.calculateConfigForFile('native/scripts/worker.js')) as EslintConfiguration;
    expect(worker.languageOptions.globals['DedicatedWorkerGlobalScope']).toBeDefined();
    expect(worker.languageOptions.globals['Buffer']).toBeUndefined();
});

test('a later [[tools.eslint.override]] runtime replaces an earlier one', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            configurations: ['javascript'],
            tools: {
                eslint: {
                    override: [
                        { paths: ['**/*.js'], runtime: 'browser' },
                        { paths: ['worker.js'], runtime: 'worker' },
                    ],
                },
            },
        }),
        'application.js': 'window.alert("value");\n',
        'worker.js': 'postMessage("value");\nwindow.alert("value");\n',
    });
    const eslint = await createEslint(sandbox.path);
    const [browser] = await eslint.lintFiles(['application.js']);
    expect(browser!.messages.some(({ ruleId }) => ruleId === 'no-undef')).toBe(false);
    const [worker] = await eslint.lintFiles(['worker.js']);
    expect(worker!.messages.find(({ ruleId }) => ruleId === 'no-undef')?.message).toBe("'window' is not defined.");
});

test.each([...FRAMEWORK_RUNTIME_CASES])('framework presets keep no globals of another runtime: %j', async (entry) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            configurations: [entry.configuration],
            tools: { eslint: { override: [{ paths: ['src/**'], runtime: 'worker' }] } },
        }),
        [entry.path]: entry.source,
    });
    const eslint = await createEslint(sandbox.path);
    const [result] = await eslint.lintFiles([entry.path]);
    for (const name of ['window', 'process'])
        expect(
            result!.messages.find(
                ({ ruleId, message }) => ruleId === 'no-undef' && message === `'${name}' is not defined.`,
            ),
        ).toBeDefined();
    expect(
        result!.messages.find(
            ({ ruleId, message }) => ruleId === 'no-undef' && message === "'postMessage' is not defined.",
        ),
    ).toBeUndefined();
});
