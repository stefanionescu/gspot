import {
    NEXT_PACKAGE,
    NEXT_PAGES_FOLDERS,
    NEXT_RULE_OPTIONS,
    NEXT_RULES,
    NEXT_SERVER_FILES,
    REACT_FILES,
} from '#cli/config/configurations/framework.ts';
import { PACKAGE_JSON } from '#cli/config/parsers.ts';
import { extractParentFolder, findEnclosingFolder } from '#cli/system/paths.ts';
import {
    type ConfigurationBlocks,
    type ConfigurationBuilder,
    type EslintScope,
} from '#cli/types/configurations/language.ts';

/**
Apply the Next.js presets and the pages and JSX settings.

@param scope the planned ESLint file of the scope.
*/
function buildNextjsBlocks(
    scope: Pick<EslintScope, 'path' | 'eslintFiles' | 'dependencyFiles' | 'sourceFiles'>,
): ConfigurationBlocks {
    const { path, eslintFiles, dependencyFiles, sourceFiles } = scope;
    const nextProjects = dependencyFiles
        .filter((file) => file.kind === PACKAGE_JSON && file.dependencies[NEXT_PACKAGE] !== undefined)
        .map((file) => extractParentFolder(file.path));
    const scopePath = findEnclosingFolder(path, new Set(nextProjects)) ?? path;
    const prefix = scopePath === '' ? '' : `${scopePath}/`;
    const hasPages = sourceFiles.some((path) => NEXT_PAGES_FOLDERS.some((folder) => path.startsWith(prefix + folder)));
    return [
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
                { package: '@next/eslint-plugin-next', path: 'configs.core-web-vitals', merge: 'rules' },
                { package: 'eslint-plugin-react-refresh', path: 'configs.next', merge: 'rules' },
            ],
            calls: [
                { name: 'addPlugins', args: [{ plugins: ['@next/eslint-plugin-next'] }] },
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
}

export const NEXTJS_BLOCK_BUILDERS: Readonly<Record<string, ConfigurationBuilder>> = {
    nextjs: buildNextjsBlocks,
};
