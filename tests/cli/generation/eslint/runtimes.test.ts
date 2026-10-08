import { z } from 'zod';
import globals from 'globals';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { readAsset } from '#cli/platform/assets.ts';
import { openSession } from '#cli/commands/session.ts';
import { parseStrictPolicy } from '#cli/policy/read.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { RuntimeConfiguration } from '#tests/types/generation/configuration-files.ts';

import {
    RUNTIME_CASES,
    INVALID_RUNTIMES,
    FRAMEWORK_RUNTIME_CASES,
} from '#tests/config/cli/generation/eslint/runtimes.ts';

test.each(RUNTIME_CASES)('runtime globals and Node.js rules are isolated: %j', async (entry) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            level: 'all',
            configurations: ['javascript'],
            tools: { eslint: { runtimes: { 'application/**': entry.runtime } } },
        }),
        'application/source.js': 'process.exit(0);\nBuffer.from("value");\n',
        'server.js': 'process.exit(0);\n',
    });
    const eslint = await createEslint(sandbox.path);
    const computed = (await eslint.calculateConfigForFile('application/source.js')) as RuntimeConfiguration;
    for (const name of entry.globals) expect(computed.languageOptions.globals[name]).toBeDefined();
    for (const name of entry.absent) expect(computed.languageOptions.globals[name]).toBeUndefined();
    expect(Object.keys(computed.rules).filter((name) => name.startsWith('n/'))).toStrictEqual([
        'n/file-extension-in-import',
    ]);
    const [result] = await eslint.lintFiles(['application/source.js']);
    expect(result!.messages.some(({ ruleId }) => ruleId === 'n/no-process-exit')).toBe(false);
    expect(
        result!.messages.filter(({ ruleId }) => ruleId === 'no-undef').map(({ message: diagnostic }) => diagnostic),
    ).toContain("'Buffer' is not defined.");
    const [server] = await eslint.lintFiles(['server.js']);
    expect(server!.messages.some(({ ruleId }) => ruleId === 'n/no-process-exit')).toBe(true);
});

test('ES modules reject CommonJS globals and .cjs files retain CommonJS execution', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'configurations = ["javascript"]\n',
        'source.mjs': 'export const folder = __dirname;\n',
        'source.cjs': 'module.exports = __dirname;\n',
    });
    const eslint = await createEslint(sandbox.path);
    const [module] = await eslint.lintFiles(['source.mjs']);
    expect(module!.messages).toContainEqual(containing({ ruleId: 'no-undef', message: "'__dirname' is not defined." }));
    const commonjs = (await eslint.calculateConfigForFile('source.cjs')) as RuntimeConfiguration;
    expect(commonjs.languageOptions.sourceType).toBe('commonjs');
    const [required] = await eslint.lintFiles(['source.cjs']);
    expect(required!.messages.some(({ ruleId }) => ruleId === 'no-undef')).toBe(false);
});

test('framework runtimes and authored overrides stay within their project scopes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'configurations = ["javascript"]\n[scope."native"]\nconfigurations = ["react-native"]\n[scope."native".tools.eslint.runtimes]\n"src/browser.js" = "browser"\n"scripts/worker.js" = "worker"\n[scope."web"]\nconfigurations = ["react"]\n[scope."native/server"]\nconfigurations = ["javascript"]\n[scope."native/server".tools.eslint.runtimes]\n"**/*" = "node"\n',
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
    const node = (await eslint.calculateConfigForFile('server.js')) as RuntimeConfiguration;
    const native = (await eslint.calculateConfigForFile('native/src/source.js')) as RuntimeConfiguration;
    const browser = (await eslint.calculateConfigForFile('native/src/browser.js')) as RuntimeConfiguration;
    const web = (await eslint.calculateConfigForFile('web/source.js')) as RuntimeConfiguration;
    expect(node.languageOptions.globals['Buffer']).toBeDefined();
    expect(native.languageOptions.globals['__DEV__']).toBeDefined();
    expect(native.languageOptions.globals['Buffer']).toBeUndefined();
    expect(browser.languageOptions.globals['window']).toBeDefined();
    expect(browser.languageOptions.globals['__DEV__']).toBeUndefined();
    expect(browser.languageOptions.globals['process']).toBeUndefined();
    expect(web.languageOptions.globals['window']).toBeDefined();
    expect(web.languageOptions.globals['process']).toBeUndefined();
    for (const file of ['native/scripts/build.js', 'native/server/source.js', 'web/scripts/build.js']) {
        const script = (await eslint.calculateConfigForFile(file)) as RuntimeConfiguration;
        expect(script.languageOptions.globals['Buffer'], file).toBeDefined();
        expect(script.rules['n/no-deprecated-api']![0]).toBe(2);
    }
    const worker = (await eslint.calculateConfigForFile('native/scripts/worker.js')) as RuntimeConfiguration;
    expect(worker.languageOptions.globals['DedicatedWorkerGlobalScope']).toBeDefined();
    expect(worker.languageOptions.globals['Buffer']).toBeUndefined();
});

test('later authored runtime selectors replace earlier environments instead of merging globals', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            configurations: ['javascript'],
            tools: { eslint: { runtimes: { '**/*.js': 'browser', 'worker.js': 'worker' } } },
        }),
        'application.js': 'window.alert("value");\n',
        'worker.js': 'postMessage("value");\nwindow.alert("value");\n',
    });
    const eslint = await createEslint(sandbox.path);
    const [browser] = await eslint.lintFiles(['application.js']);
    expect(browser!.messages.some(({ ruleId }) => ruleId === 'no-undef')).toBe(false);
    const [worker] = await eslint.lintFiles(['worker.js']);
    expect(
        worker!.messages.filter(({ ruleId }) => ruleId === 'no-undef').map(({ message: diagnostic }) => diagnostic),
    ).toStrictEqual(["'window' is not defined."]);
});

test.each(FRAMEWORK_RUNTIME_CASES)('framework presets retain no globals from another runtime: %j', async (entry) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            configurations: [entry.configuration],
            tools: { eslint: { runtimes: { 'src/**': 'worker' } } },
        }),
        [entry.path]: entry.source,
    });
    const eslint = await createEslint(sandbox.path);
    const [result] = await eslint.lintFiles([entry.path]);
    const messages = result!.messages
        .filter(({ ruleId }) => ruleId === 'no-undef')
        .map(({ message: diagnostic }) => diagnostic);
    expect(messages).toContain("'window' is not defined.");
    expect(messages).toContain("'process' is not defined.");
    expect(messages).not.toContain("'postMessage' is not defined.");
});

test('the shipped runtime names match the pinned globals data', () => {
    const names = Object.keys(globals)
        .filter((name) => name !== 'serviceworker')
        .concat('service-worker')
        .toSorted((left, right) => left.localeCompare(right));
    const runtimeNames = z
        .array(z.string())
        .parse(JSON.parse(readAsset('configurations/language/javascript/runtime-names.json')));
    expect([...runtimeNames].toSorted((left, right) => left.localeCompare(right))).toStrictEqual(names);
});

test.each(INVALID_RUNTIMES)('invalid runtime %s identifies the authored setting', (runtime) => {
    const text = stringify({ configurations: ['javascript'], tools: { eslint: { runtimes: { '**/*.js': runtime } } } });
    expect(() => parseStrictPolicy(text)).toThrow('tools.eslint.runtimes.**/*.js');
    expect(() => parseStrictPolicy(text)).toThrow('Invalid option');
});

test('root runtime choices reach active descendants without adding an inactive namespace to sibling scopes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `configurations = []
[tools.eslint.runtimes]
"**/browser.js" = "browser"
[scope."api"]
configurations = ["javascript"]
[scope."api/deep"]
[scope."api/deep".tools.eslint.runtimes]
"**/*" = "worker"
[scope."notes"]
configurations = ["markdown"]
`,
        'api/browser.js': 'window.alert("ready");',
        'api/server.js': 'export const value = 1;',
        'api/deep/browser.js': 'postMessage("ready");',
        'notes/README.md': '# Notes\n',
    });
    const session = await openSession(sandbox.path);
    const views = new Map(session.scopes.map((selection) => [selection.scope.path, selection.view]));
    expect(views.get('')!.values['tools.eslint']).toBeUndefined();
    expect(views.get('notes')!.values['tools.eslint']).toBeUndefined();
    expect(views.get('api')!.options('tools.eslint').runtimes).toStrictEqual({ '**/browser.js': 'browser' });
    expect(session.policyFiles.policy.authored.tools!.eslint!.runtimes).toStrictEqual({ '**/browser.js': 'browser' });
    expect(session.policyFiles.policy.authored.tools!.eslint).not.toHaveProperty('rules');
    const eslint = await createEslint(sandbox.path);
    const browser = (await eslint.calculateConfigForFile('api/browser.js')) as RuntimeConfiguration;
    const server = (await eslint.calculateConfigForFile('api/server.js')) as RuntimeConfiguration;
    const worker = (await eslint.calculateConfigForFile('api/deep/browser.js')) as RuntimeConfiguration;
    expect(browser.languageOptions.globals['window']).toBeDefined();
    expect(browser.languageOptions.globals['Buffer']).toBeUndefined();
    expect(server.languageOptions.globals['Buffer']).toBeDefined();
    expect(worker.languageOptions.globals['postMessage']).toBeDefined();
    expect(worker.languageOptions.globals['window']).toBeUndefined();
});

test.each(['mise', 'npm'] as const)('Mise task defaults follow the selected runner: %s', async (runner) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `runner = "${runner}"\nconfigurations = ["javascript", "react"]\n[scope.web]\nconfigurations = ["javascript", "react"]\n`,
        '.mise/tasks/build.js': 'process.exit(0);\n',
        'web/.mise/tasks/build.js': 'process.exit(0);\n',
    });
    const eslint = await createEslint(sandbox.path);
    for (const file of ['.mise/tasks/build.js', 'web/.mise/tasks/build.js']) {
        const computed = (await eslint.calculateConfigForFile(file)) as RuntimeConfiguration;
        expect(computed.languageOptions.globals['process'], file).toBe(runner === 'mise' ? false : undefined);
    }
});
