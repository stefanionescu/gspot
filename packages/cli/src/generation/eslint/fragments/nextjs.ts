import { serializePresetAccess } from '#cli/generation/eslint/print.ts';
import type { FragmentPresets, EslintFragmentInputs } from '#cli/types/generation/eslint.ts';

import {
    NEXT_RULES,
    JSX_CODE_FILES,
    NEXT_SERVER_FILES,
    NEXT_PAGES_FOLDERS,
} from '#cli/config/generation/eslint-fragments.ts';

/**
 * Write nextjs ESLint rules for the selected scope.
 *
 * @param root0 the values for this generated file.
 * @param root0.eslintPresets the declared ESLint preset reader.
 * @param root0.eslintModule the ESLint block writer.
 * @param root0.eslintFiles the code and test file selectors.
 * @param root0.scope the selected project scope.
 * @param root0.files the selected source files.
 * @param root0.json the JSON writer for emitted options.
 *
 * @returns the ESLint fragment source.
 */
export function buildNextjsFragment({
    eslintPresets,
    eslintModule,
    eslintFiles,
    scope,
    files,
    json,
}: Pick<EslintFragmentInputs, 'eslintPresets' | 'eslintModule' | 'eslintFiles' | 'scope' | 'files' | 'json'>): string {
    const output: string[] = [
        "import nextPlugin from '@next/eslint-plugin-next';\nimport reactRefresh from 'eslint-plugin-react-refresh';\n",
    ];
    const presets = eslintPresets('nextjs') as FragmentPresets;
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
    return output.join('');
}
