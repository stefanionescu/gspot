import { serializePresetAccess } from '#cli/generation/eslint/print.ts';
import { type EslintContext, type EslintFragment, type FragmentPresets } from '#cli/types/generation/eslint.ts';

import {
    NEXT_RULES,
    JSX_CODE_FILES,
    NEXT_SERVER_FILES,
    NEXT_PAGES_FOLDERS,
} from '#cli/config/generation/eslint-fragments.ts';

/**
 * Apply Next.js presets and the selected pages and JSX settings.
 * @param context the selected presets, rule printer, and scope settings.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildNextjsFragment(
    context: Pick<EslintContext, 'eslintPresets' | 'eslintModule' | 'eslintFiles' | 'scope' | 'files' | 'json'>,
): EslintFragment {
    const { eslintPresets, eslintModule, eslintFiles, scope, files, json } = context;

    const imports: string[] = [
        "import nextPlugin from '@next/eslint-plugin-next';",
        "import reactRefresh from 'eslint-plugin-react-refresh';",
    ];

    const output: string[] = ['\n\n'];
    const presets = eslintPresets.get('nextjs') as FragmentPresets;
    const prefix = scope === '' ? '' : `${scope}/`;
    const hasPages = files('').some((path) => NEXT_PAGES_FOLDERS.some((folder) => path.startsWith(prefix + folder)));
    output.push(
        '\n',
        eslintModule.block(
            {
                files: JSX_CODE_FILES,
                rules: {
                    ...presets.recommended.blocks[0].rules,
                    '@next/next/no-html-link-for-pages': hasPages
                        ? NEXT_RULES['@next/next/no-html-link-for-pages']
                        : 'off',
                    ...presets.refresh.blocks[0].rules,
                    '@next/next/no-async-client-component': NEXT_RULES['@next/next/no-async-client-component'],
                },
            },
            `plugins: { '@next/next': nextPlugin }, settings: { next: { rootDir: root + '/' + ${json(scope)} } }`,
            {
                expression: `{ ...${serializePresetAccess('nextPlugin', presets.recommended.source)}.rules, ...${serializePresetAccess('reactRefresh', presets.refresh.source)}.rules }`,
                rules: { ...presets.recommended.blocks[0].rules, ...presets.refresh.blocks[0].rules },
            },
        ),
        ',\n',
        eslintModule.block({
            files: NEXT_SERVER_FILES.flatMap((place) => eslintFiles.code.map((pattern) => [place, pattern])),
            rules: { 'gspot/require-server-only': NEXT_RULES['gspot/require-server-only'] },
        }),
        ',\n',
    );
    return { imports: imports, blocks: output.join('') };
}

export { buildNextjsFragment };
