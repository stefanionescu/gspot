// The literal values acceptance/release reads: names, patterns, limits, and tables.

export const CONSUMER = String.raw`
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ESLint } from 'eslint';
import plugin from '@gspot/eslint-plugin';
const require = createRequire(import.meta.url);
const commonjs = require('@gspot/eslint-plugin');
for (const published of [plugin, commonjs.default ?? commonjs]) {
    for (const level of ['recommended', 'all']) {
        const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: [published.configs[level]] });
        const invalid = await eslint.lintText('const source = 1;\nexport const alias = source;\n', { filePath: 'example.js' });
        assert.equal(invalid.length, 1);
        assert.deepEqual(invalid[0].messages.map(({ ruleId, line, column, message }) => ({ ruleId, line, column, message })), level === 'recommended' ? [] : [{
            ruleId: 'gspot/no-exported-alias-constants', line: 2, column: 14,
            message: 'alias only renames source. Export the source value directly instead of an alias.',
        }]);
        const defect = await eslint.lintText("'use client';\nconsole.log(process.env.SECRET);\n", { filePath: 'client.js' });
        assert.deepEqual(defect[0].messages.filter(({ ruleId }) => ruleId === 'gspot/no-client-environment').map(({ line, column, messageId }) => ({ line, column, messageId })), [{line: 2, column: 13, messageId: 'private'}]);
        const corrected = await eslint.lintText('export const source = 1;\n', { filePath: 'example.js' });
        assert.equal(corrected.length, 1);
        assert.deepEqual(corrected[0].messages, []);
        const layout = await eslint.lintText('export const value = 1;\nconst internal = 2;\nconsole.log(internal);\n', { filePath: 'example.js' });
        assert.deepEqual(layout[0].messages.filter(({ ruleId }) => ruleId === 'gspot/private-before-public').map(({ ruleId, line }) => ({ ruleId, line })), level === 'recommended' ? [] : [{ ruleId: 'gspot/private-before-public', line: 2 }]);
        const forwarding = await eslint.lintText('function forward(value) { return build(value); }\n', { filePath: 'example.js' });
        assert.equal(forwarding.length, 1);
        assert.deepEqual(forwarding[0].messages.map(({ ruleId }) => ruleId).sort(), ['gspot/no-trivial-files', 'gspot/no-trivial-functions']);
        assert.equal(forwarding[0].messages.find(({ ruleId }) => ruleId === 'gspot/no-trivial-functions').message, 'This function has 1 executable statements, at most 2. Inline it or explain its required API with a narrow suppression.');
    }
    const server = new ESLint({ overrideConfigFile: true, overrideConfig: [{
        files: ['**/server.js'], plugins: { gspot: published }, rules: { 'gspot/require-server-only': 'error' },
    }] });
    const invalidServer = await server.lintText('export const secret = 1;', { filePath: 'server.js' });
    assert.equal(invalidServer.length, 1);
    assert.deepEqual(invalidServer[0].messages.map(({ ruleId, line, column, message }) => ({ ruleId, line, column, message })), [{
        ruleId: 'gspot/require-server-only', line: 1, column: 1,
        message: 'Mark this server module with import "server-only" so a client bundle can never include it.',
    }]);
    const ordinary = await server.lintText('export const value = 1;', { filePath: 'ordinary.js' });
    assert.equal(ordinary.length, 1);
    assert.deepEqual(ordinary[0].messages, []);
    const correctedServer = await server.lintText('import "server-only"; export const secret = 1;', { filePath: 'server.js' });
    assert.equal(correctedServer.length, 1);
    assert.deepEqual(correctedServer[0].messages, []);
 }
const readmeCases = [
    { config: './readme-0.mjs', file: 'client.js', broken: "'use client';\nconsole.log(process.env.SECRET);", fixed: "'use client';\nconsole.log('public');", rule: 'gspot/no-client-environment' },
    { config: './readme-3.mjs', file: 'server/example.js', broken: 'export const value = 1;', fixed: "import 'server-only'; export const value = 1;", rule: 'gspot/require-server-only' },
];
for (const example of readmeCases) {
    const config = await import(example.config);
    const eslint = new ESLint({overrideConfigFile: true, overrideConfig: config.default});
    const failed = await eslint.lintText(example.broken, {filePath: example.file});
    assert.deepEqual(failed[0].messages.map(({ruleId}) => ruleId), [example.rule]);
    const corrected = await eslint.lintText(example.fixed, {filePath: example.file});
    assert.deepEqual(corrected[0].messages, []);
}
`;
export const DECLARATIONS = `
import plugin from '@gspot/eslint-plugin';
import type { TSESLint } from '@typescript-eslint/utils';
const configs: TSESLint.FlatConfig.Config[] = [plugin.configs.recommended, plugin.configs.all];
const rule: TSESLint.RuleModule<string, readonly unknown[]> | undefined = plugin.rules['no-trivial-functions'];
console.log(configs, rule);
`;
export const REGISTRY_TIMEOUT_MS = 30_000;
