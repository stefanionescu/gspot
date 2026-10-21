// Build the ESLint tool file from the settings and the scope.
import { GspotError } from '#cli/system/errors.ts';
import { getPreset } from '#cli/generation/eslint/presets.ts';
import { listIgnoredGlobs } from '#cli/generation/ignore-files.ts';
import { type ToolFileContext } from '#cli/types/generation/files.ts';
import { buildEslintContext } from '#cli/generation/eslint/context.ts';
import { buildRuntimeBlocks } from '#cli/generation/eslint/runtimes.ts';
import { JAVASCRIPT_CONFIGURATION } from '#cli/config/configurations.ts';
import { buildBoundaryBlocks } from '#cli/generation/eslint/boundaries.ts';
import { buildSelectedBlocks } from '#cli/generation/eslint/lint-rules.ts';
import { collectFragments } from '#cli/generation/eslint/fragments/build.ts';
import { serializeBlocks, listUnappliedRules } from '#cli/generation/eslint/block-writer.ts';
import { listLocalPlugins, buildLocalPluginBlocks } from '#cli/generation/eslint/local-plugins.ts';
import { CODE_PRESETS, FILE_PRESETS, ESLINT_CHECK, ESLINT_BASE_LABEL } from '#cli/config/generation/eslint.ts';
import { selectPlugins, buildBlocksAfterFragments, buildBlocksBeforeFragments } from '#cli/generation/eslint/base.ts';

import {
    serializeBlock,
    serializeImports,
    indentEslintBlock,
    serializeRuntimeSelectors,
} from '#cli/generation/eslint/print.ts';

/**
 * Build the ESLint file from the presets, lint rules, and fragment blocks.
 *
 * @param context the tool file to build.
 * @returns the JavaScript text of the ESLint file.
 */
function buildEslintFile(context: ToolFileContext): string {
    const { session } = context;

    const base = buildEslintContext(context);
    const { blockInput } = base;
    const runtimes = buildRuntimeBlocks(session.scopes);
    const boundaryBlocks = buildBoundaryBlocks(base);
    const ignoredPaths = listIgnoredGlobs(session, context.selection.view, ESLINT_CHECK);
    const { fragmentParts, fragmentImports, fragmentSelectors } = collectFragments(session, base);
    const shipped = selectPlugins(base, boundaryBlocks);
    const plugins = { ...shipped, ...listLocalPlugins(session.scopes, context.targetPath, shipped) };
    const presets = base.eslintPresets.get(JAVASCRIPT_CONFIGURATION);
    const capturedImports = Object.fromEntries<readonly [string, string]>(
        [...CODE_PRESETS, ...FILE_PRESETS].map(([name, importName]) => [
            importName,
            [importName, getPreset(presets, name).package],
        ]),
    );
    const output: string[] = [
        serializeImports({ ...capturedImports, ...plugins }, fragmentImports),
        serializeRuntimeSelectors(runtimes),
        'export default [',
        '    // Shared ignore sections.',
        indentEslintBlock(serializeBlock({ ignores: ignoredPaths })) + ',',
        serializeBlocks(blockInput, [
            ...buildBlocksBeforeFragments(base, plugins, boundaryBlocks, ignoredPaths).map((block) => ({
                ...block,
                label: ESLINT_BASE_LABEL,
            })),
            ...fragmentParts,
            ...buildBlocksAfterFragments(base, fragmentSelectors, runtimes).map((block) => ({
                ...block,
                label: ESLINT_BASE_LABEL,
            })),
            ...[...buildSelectedBlocks(base), ...buildLocalPluginBlocks(session.scopes, base.eslintFiles.code)].map(
                (data) => ({ data, label: ESLINT_BASE_LABEL }),
            ),
        ]) + ',',
        '];',
        '',
    ];
    const unapplied = listUnappliedRules(blockInput);
    if (unapplied.length > 0) {
        const level = session.settingsFile.settings.level;
        throw new GspotError(
            'settings',
            unapplied
                .map(
                    (rule) =>
                        `${rule} does not run at level ${level}; gspot sets options only for rules it runs. Use tools.eslint.plugins for your own rules.`,
                )
                .join('\n'),
        );
    }
    return output.join('\n');
}

export { buildEslintFile };
