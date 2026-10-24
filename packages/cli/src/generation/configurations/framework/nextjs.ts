import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';

import {
    REACT_FILES,
    CONFIGURATION_PLUGINS,
} from '#cli/config/generation/configurations/language/javascript/eslint/configuration-blocks.ts';
import {
    getPreset,
    addRuleOptions,
    buildPresetRuleExpression,
} from '#cli/generation/configurations/language/javascript/eslint/presets.ts';
import {
    NEXT_RULES,
    REFRESH_RULE,
    NEXT_ERROR_HOCS,
    NEXT_SERVER_FILES,
    NEXT_PAGES_FOLDERS,
} from '#cli/config/generation/configurations/framework/nextjs.ts';

/**
Apply the Next.js presets and the pages and JSX settings.

@param scope the planned ESLint file of the scope.
@returns the imports and ESLint blocks for this configuration.
*/
export function buildNextjsBlocks(
    scope: Pick<EslintScope, 'presets' | 'eslintFiles' | 'scopePath' | 'sourceFiles'>,
): ConfigurationBlocks {
    const { presets, eslintFiles, scopePath, sourceFiles } = scope;
    const recommended = getPreset(presets, 'recommended');
    const refresh = getPreset(presets, 'refresh');
    const blocks: ConfigurationBlocks['blocks'] = [];
    const prefix = scopePath === '' ? '' : `${scopePath}/`;
    const hasPages = sourceFiles.some((path) => NEXT_PAGES_FOLDERS.some((folder) => path.startsWith(prefix + folder)));
    blocks.push(
        {
            fields: {
                files: REACT_FILES,
                rules: {
                    ...recommended.blocks[0].rules,
                    '@next/next/no-html-link-for-pages': hasPages
                        ? NEXT_RULES['@next/next/no-html-link-for-pages']
                        : 'off',
                    ...refresh.blocks[0].rules,
                    [REFRESH_RULE]: addRuleOptions(refresh.blocks[0].rules?.[REFRESH_RULE], {
                        extraHOCs: [...NEXT_ERROR_HOCS],
                    }),
                    '@next/next/no-async-client-component': NEXT_RULES['@next/next/no-async-client-component'],
                },
            },
            properties: `plugins: { '@next/next': nextPlugin }, settings: { next: { rootDir: root + '/' + ${JSON.stringify(scopePath)} } }`,
            preset: buildPresetRuleExpression([
                ['nextPlugin', recommended],
                ['reactRefresh', refresh],
            ]),
        },
        {
            fields: {
                files: NEXT_SERVER_FILES.flatMap((place) => eslintFiles.code.map((pattern) => [place, pattern])),
                rules: { 'gspot/require-server-only': NEXT_RULES['gspot/require-server-only'] },
            },
        },
    );
    return {
        imports: CONFIGURATION_PLUGINS['nextjs'],
        blocks,
    };
}
