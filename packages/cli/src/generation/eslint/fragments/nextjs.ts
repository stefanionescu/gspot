import { serializePresetAccess } from '#cli/generation/eslint/print.ts';
import { type EslintContext, type EslintFragment, type FragmentPresets } from '#cli/types/generation/eslint.ts';

import {
    NEXT_RULES,
    REFRESH_RULE,
    JSX_CODE_FILES,
    NEXT_EXTRA_HOCS,
    NEXT_SERVER_FILES,
    NEXT_PAGES_FOLDERS,
} from '#cli/config/generation/eslint-fragments.ts';

// Next.js wraps a component in an error boundary with catchError from next/error, which react-refresh does not know.
function addExtraHocs(entry: unknown): unknown {
    if (!Array.isArray(entry)) return entry;
    const [severity, options] = entry as [unknown, Record<string, unknown> | undefined];
    return [severity, { ...options, extraHOCs: [...NEXT_EXTRA_HOCS] }];
}

/**
 * Apply the Next.js presets and the pages and JSX settings.
 *
 * @param context the ESLint inputs of the scope.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildNextjsFragment(
    context: Pick<EslintContext, 'eslintPresets' | 'blockWriter' | 'eslintFiles' | 'scope' | 'sourceFiles'>,
): EslintFragment {
    const { eslintPresets, blockWriter, eslintFiles, scope, sourceFiles } = context;

    const imports: string[] = [
        "import nextPlugin from '@next/eslint-plugin-next';",
        "import reactRefresh from 'eslint-plugin-react-refresh';",
    ];

    const output: string[] = ['\n\n'];
    const presets = eslintPresets.get('nextjs') as FragmentPresets;
    const prefix = scope === '' ? '' : `${scope}/`;
    const hasPages = sourceFiles.some((path) => NEXT_PAGES_FOLDERS.some((folder) => path.startsWith(prefix + folder)));
    output.push(
        '\n',
        blockWriter.block(
            {
                files: JSX_CODE_FILES,
                rules: {
                    ...presets.recommended.blocks[0].rules,
                    '@next/next/no-html-link-for-pages': hasPages
                        ? NEXT_RULES['@next/next/no-html-link-for-pages']
                        : 'off',
                    ...presets.refresh.blocks[0].rules,
                    [REFRESH_RULE]: addExtraHocs(presets.refresh.blocks[0].rules?.[REFRESH_RULE]),
                    '@next/next/no-async-client-component': NEXT_RULES['@next/next/no-async-client-component'],
                },
            },
            `plugins: { '@next/next': nextPlugin }, settings: { next: { rootDir: root + '/' + ${JSON.stringify(scope)} } }`,
            {
                expression: `{ ...${serializePresetAccess('nextPlugin', presets.recommended.source)}.rules, ...${serializePresetAccess('reactRefresh', presets.refresh.source)}.rules }`,
                rules: { ...presets.recommended.blocks[0].rules, ...presets.refresh.blocks[0].rules },
            },
        ),
        ',\n',
        blockWriter.block({
            files: NEXT_SERVER_FILES.flatMap((place) => eslintFiles.code.map((pattern) => [place, pattern])),
            rules: { 'gspot/require-server-only': NEXT_RULES['gspot/require-server-only'] },
        }),
        ',\n',
    );
    return { imports: imports, blocks: output.join('') };
}

export { buildNextjsFragment };
