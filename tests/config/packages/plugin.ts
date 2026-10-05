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
}
`;

export const DECLARATIONS = `
import plugin from '@gspothq/eslint-plugin';
import type { TSESLint } from '@typescript-eslint/utils';
const configs: TSESLint.FlatConfig.Config[] = [plugin.configs.recommended, plugin.configs.all];
const rule: TSESLint.RuleModule<string, readonly unknown[]> | undefined = plugin.rules['no-trivial-functions'];
console.log(configs, rule);
`;
