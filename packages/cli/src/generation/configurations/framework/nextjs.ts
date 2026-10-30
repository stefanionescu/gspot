import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { CONFIGURATION_PLUGINS } from '#cli/config/generation/configurations/language/javascript/eslint/configuration-blocks.ts';

import {
    NEXT_RULES,
    REACT_FILES,
    NEXT_RULE_OPTIONS,
    NEXT_SERVER_FILES,
    NEXT_PAGES_FOLDERS,
} from '#cli/config/generation/configurations/framework/nextjs.ts';

/**
Apply the Next.js presets and the pages and JSX settings.

@param scope the planned ESLint file of the scope.
*/
export function buildNextjsBlocks(
    scope: Pick<EslintScope, 'eslintFiles' | 'projectPath' | 'sourceFiles'>,
): ConfigurationBlocks {
    const { eslintFiles, projectPath: scopePath, sourceFiles } = scope;
    const prefix = scopePath === '' ? '' : `${scopePath}/`;
    const hasPages = sourceFiles.some((path) => NEXT_PAGES_FOLDERS.some((folder) => path.startsWith(prefix + folder)));
    const blocks: ConfigurationBlocks['blocks'] = [
        {
            fields: {
                files: REACT_FILES,
                rules: {
                    '@next/next/no-html-link-for-pages': hasPages
                        ? NEXT_RULES['@next/next/no-html-link-for-pages']
                        : 'off',
                    '@next/next/no-async-client-component': NEXT_RULES['@next/next/no-async-client-component'],
                },
            },
            presets: [
                { importName: 'nextPlugin', path: 'configs.core-web-vitals', merge: 'rules' },
                { importName: 'reactRefresh', path: 'configs.next', merge: 'rules' },
            ],
            calls: [
                { name: 'addPlugins', args: [{ imports: { '@next/next': 'nextPlugin' } }] },
                { name: 'setRootFolder', args: [{ value: [['settings', 'next', 'rootDir']] }, { value: scopePath }] },
                { name: 'mergeRuleOptions', args: [{ value: NEXT_RULE_OPTIONS }] },
            ],
        },
        {
            fields: {
                files: NEXT_SERVER_FILES.flatMap((place) => eslintFiles.code.map((pattern) => [place, pattern])),
                rules: { 'gspot/require-server-only': NEXT_RULES['gspot/require-server-only'] },
            },
        },
    ];
    return {
        imports: CONFIGURATION_PLUGINS.nextjs,
        blocks,
    };
}
