export const PROSE_CHECK = {
    check: 'prose/vale',
    files: {
        'guide.md': `# Schedule

NebulaConfiguration uses Python. Release on 03/04/2026.
`,
    },
    corrected: {
        files: {
            'guide.md': `# Schedule

NebulaConfiguration uses Python. Release on March 4, 2026.
`,
        },
    },
    expected: { file: 'guide.md', line: 3, rule: 'gspot.dates' },
} as const;

export const SWIFT_CHECK = {
    check: 'naming/identifiers',
    files: { 'Account.swift': 'let utils = 1\n' },
    corrected: { files: { 'Account.swift': 'let account = 1\n' } },
    expected: { file: 'Account.swift', line: 1, rule: 'banned-word' },
} as const;

/** Starting files that the packed launcher test replaces or reads. */
export const STARTING_FILES = {
    '.editorconfig': `root = true
[*]
indent_size = 2
[*.json]
indent_size = 4
`,
    'prettier.config.mjs':
        'console.log("formatter stdout"); console.error("formatter stderr"); export default { semi: false };\n',
    'source.js': 'const greeting="hello";',
    'broken.sh': 'if then\n',
    'authored.txt': 'Preserve this authored file.\n',
    'AGENTS.md': '# Team notes\n',
    'CLAUDE.md': `# Claude notes

Run the tests.
`,
} as const;

/** The exact ShellCheck findings for the syntax sample of the launcher test. */
export const SHELLCHECK_SYNTAX_FINDINGS = [
    {
        check: 'bash/shellcheck',
        file: 'broken.sh',
        line: 1,
        column: 1,
        rule: 'SC1073',
        message: "Couldn't parse this if expression. Fix to allow more checks.",
        fixable: false,
    },
    {
        check: 'bash/shellcheck',
        file: 'broken.sh',
        line: 1,
        column: 8,
        rule: 'SC1072',
        message: 'Unexpected keyword/token. Fix any mentioned problems and try again.',
        fixable: false,
    },
] as const;

export const MODULE_PROGRAM = String.raw`
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ESLint } from 'eslint';
import plugin from '@gspothq/eslint-plugin';
const require = createRequire(import.meta.url);
const commonjs = require('@gspothq/eslint-plugin');
for (const published of [plugin, commonjs.default]) {
    for (const level of ['recommended', 'all']) {
        const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: [published.configs[level]] });
        const client = await eslint.lintText("'use client';\nconsole.log(process.env.SECRET);\n", { filePath: 'client.js' });
        assert.deepEqual(client[0].messages.filter(({ ruleId }) => ruleId === 'gspot/no-client-env').map(({ line, messageId }) => ({ line, messageId })), [{ line: 2, messageId: 'private' }]);
    }
}
`;

export const TYPE_PROGRAM = `
import plugin from '@gspothq/eslint-plugin';
import type { TSESLint } from '@typescript-eslint/utils';
const configs: TSESLint.FlatConfig.Config[] = [plugin.configs.recommended, plugin.configs.all];
const rule: TSESLint.RuleModule<string, readonly unknown[]> | undefined = plugin.rules['import-boundaries'];
console.log(configs, rule);
`;
