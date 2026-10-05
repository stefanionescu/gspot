import pluginPackage from '#plugin-package' with { type: 'json' };
import testsPackage from '#tests/package.json' with { type: 'json' };
import workspacePackage from '#workspace-package' with { type: 'json' };

/** Consumer tools are installed explicitly, independent of the plugin's runtime dependencies. */
export const pluginConsumerTools = [
    `eslint@${pluginPackage.devDependencies.eslint}`,
    `typescript@${workspacePackage.devDependencies.typescript}`,
    `@typescript-eslint/utils@${testsPackage.devDependencies['@typescript-eslint/rule-tester']}`,
];

export const CONSUMER = String.raw`
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ESLint } from 'eslint';
import plugin from '@gspothq/eslint-plugin';
const require = createRequire(import.meta.url);
const commonjs = require('@gspothq/eslint-plugin');
for (const published of [plugin, commonjs.default ?? commonjs]) {
    for (const level of ['recommended', 'all']) {
        const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: [{ languageOptions: { globals: { process: 'readonly' } } }, published.configs[level]] });
        const client = await eslint.lintText("'use client';\nconsole.log(process.env.SECRET);\n", { filePath: 'client.js' });
        assert.deepEqual(client[0].messages.filter(({ ruleId }) => ruleId === 'gspot/no-client-env').map(({ line, messageId }) => ({ line, messageId })), [{ line: 2, messageId: 'private' }]);
        const alias = await eslint.lintText('const source = 1;\nexport const alias = source;\n', { filePath: 'example.js' });
        assert.deepEqual(alias[0].messages.map(({ ruleId, line }) => ({ ruleId, line })), level === 'recommended' ? [] : [{ ruleId: 'gspot/no-alias-exports', line: 2 }]);
        const corrected = await eslint.lintText('export const source = 1;\n', { filePath: 'example.js' });
        assert.deepEqual(corrected[0].messages, []);
        const declaration = await eslint.lintText('import "polyfill";\nexport class Task { constructor() { this.ready = true; } }\n', { filePath: 'task.js' });
        assert.equal(declaration[0].fatalErrorCount, 0);
        assert.deepEqual(declaration[0].messages, []);
    }
    const browser = new ESLint({ overrideConfigFile: true, overrideConfig: [{
        files: ['browser/**/*.js'],
        plugins: { gspot: published },
        languageOptions: { globals: { process: 'readonly' } },
        rules: { 'gspot/no-client-env': ['error', {
            isClient: true,
            publicPrefixes: ['PUBLIC_'],
            allowed: ['APP_MODE'],
        }] },
    }] });
    const publicReads = 'const mode = process.env.APP_MODE;\nconst url = process.env.PUBLIC_URL;\n';
    const privateRead = 'const secret = process.env.PRIVATE_KEY;\n';
    const defect = await browser.lintText(publicReads + privateRead, { filePath: 'browser/settings.js' });
    assert.deepEqual(defect[0].messages.map(({ ruleId, line, messageId }) => ({ ruleId, line, messageId })), [{ ruleId: 'gspot/no-client-env', line: 3, messageId: 'private' }]);
    const corrected = await browser.lintText(publicReads, { filePath: 'browser/settings.js' });
    assert.deepEqual(corrected[0].messages, []);
    const server = await browser.lintText(privateRead, { filePath: 'server/settings.js' });
    assert.deepEqual(server[0].messages, []);
    const boundaries = new ESLint({ overrideConfigFile: true, overrideConfig: [{
        plugins: { gspot: published },
        rules: { 'gspot/import-boundaries': ['error', {
            folders: ['api', 'supabase'],
            aliases: { '@db/': 'supabase/' },
        }] },
    }] });
    const crossing = await boundaries.lintText("import { a } from '../../supabase/a.js';\n", { filePath: 'api/src/task.js' });
    assert.deepEqual(crossing[0].messages.map(({ ruleId, messageId, fix }) => ({ ruleId, messageId, fix: fix.text })), [{ ruleId: 'gspot/import-boundaries', messageId: 'alias', fix: "'@db/a.js'" }]);
    const packageImport = await boundaries.lintText("import { a } from '@db/a.js';\n", { filePath: 'api/src/task.js' });
    assert.deepEqual(packageImport[0].messages, []);
    const within = await boundaries.lintText("import { a } from '../types/a.js';\n", { filePath: 'api/src/task.js' });
    assert.deepEqual(within[0].messages, []);
    const escape = await boundaries.lintText("export * from '../../quality/a.js';\n", { filePath: 'api/src/task.js' });
    assert.deepEqual(escape[0].messages.map(({ ruleId, messageId }) => ({ ruleId, messageId })), [{ ruleId: 'gspot/import-boundaries', messageId: 'escape' }]);
}
`;

export const DECLARATIONS = `
import plugin from '@gspothq/eslint-plugin';
import type { TSESLint } from '@typescript-eslint/utils';
const configs: TSESLint.FlatConfig.Config[] = [plugin.configs.recommended, plugin.configs.all];
const rule: TSESLint.RuleModule<string, readonly unknown[]> | undefined = plugin.rules['import-boundaries'];
console.log(configs, rule);
`;
