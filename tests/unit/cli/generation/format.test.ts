import { describe, expect, test } from 'bun:test';
import { parsePolicyText } from '#cli/policy/read.ts';
import { prettierConfiguration } from '#cli/generation/formatting/settings.ts';

const policy = parsePolicyText(
    'version = 1\nconfigurations = ["formatting"]\n[[format.overrides]]\npaths = ["docs/**"]\nprint_width = 80\n',
    'gspot.toml',
);
const svelte = {
    name: 'prettier-plugin-svelte',
    entry: 'plugin.js',
    overrides: [{ files: '*.svelte', options: { embeddedLanguageFormatting: 'auto' } }],
};

describe('prettierConfig', () => {
    test('a plugin is loaded from the private installation relative to each configuration file', () => {
        expect(
            prettierConfiguration(policy, '.gspot/config/prettier.json', undefined, [svelte])['plugins'],
        ).toStrictEqual(['../../.gspot/node_modules/prettier-plugin-svelte/plugin.js']);
        expect(prettierConfiguration(policy, '.prettierrc.json', undefined, [svelte])['plugins']).toStrictEqual([
            './.gspot/node_modules/prettier-plugin-svelte/plugin.js',
        ]);
    });

    test('plugin overrides come before policy overrides, and no plugin adds no key', () => {
        const pluginPolicy = prettierConfiguration(policy, '.gspot/config/prettier.json', undefined, [svelte]);
        expect(pluginPolicy['overrides']).toMatchObject([
            { files: '*.svelte', options: { embeddedLanguageFormatting: 'auto' } },
            { files: ['../../docs/**'], options: { printWidth: 80 } },
        ]);
        const without = prettierConfiguration(policy, '.gspot/config/prettier.json', undefined, []);
        expect(without).not.toHaveProperty('plugins');
        expect(without['overrides']).toMatchObject([{ files: ['../../docs/**'] }]);
    });
});
