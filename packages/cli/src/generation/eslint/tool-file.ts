// Build the ESLint tool file from the settings and the scope.
import { GspotError } from '#cli/system/errors.ts';
import { getPreset } from '#cli/generation/eslint/presets.ts';
import { JSON_INDENT } from '#cli/config/generation/generate.ts';
import { buildRuntimes } from '#cli/generation/eslint/runtimes.ts';
import { type PlannedToolFile } from '#cli/types/generation/files.ts';
import { buildPlannedEslintFile } from '#cli/generation/eslint/plan.ts';
import { JAVASCRIPT_CONFIGURATION } from '#cli/config/configurations.ts';
import { buildBoundaryBlocks } from '#cli/generation/eslint/boundaries.ts';
import { listIgnoredGlobs } from '#cli/generation/settings/ignore-files.ts';
import { ESLINT_CHECK } from '#cli/config/generation/eslint/settings-blocks.ts';
import { buildSelectedBlocks } from '#cli/generation/eslint/settings-blocks.ts';
import { listConfigurationBlocks } from '#cli/generation/eslint/configurations/build.ts';
import { serializeBlocks, listUnappliedRules } from '#cli/generation/eslint/block-writer.ts';
import { listLocalPlugins, buildLocalPluginBlocks } from '#cli/generation/eslint/local-plugins.ts';
import { serializeBlock, serializeImports, indentEslintBlock } from '#cli/generation/eslint/print.ts';
import { selectPlugins, buildClosingBlocks, buildOpeningBlocks } from '#cli/generation/eslint/base.ts';

import {
    ESLINT_BASE_LABEL,
    PRESETS_AFTER_CONFIGURATIONS,
    PRESETS_BEFORE_CONFIGURATIONS,
} from '#cli/config/generation/eslint/base.ts';

/**
 * Build the ESLint file from the presets, lint rules, and fragment blocks.
 *
 * @param planned the tool file to build.
 * @returns the JavaScript text of the ESLint file.
 */
export function buildEslintFile(planned: PlannedToolFile): string {
    const { session } = planned;

    const eslintContext = buildPlannedEslintFile(planned);
    const { blockInput } = eslintContext;
    const runtimes = buildRuntimes(session.scopes);
    const boundaryBlocks = buildBoundaryBlocks(eslintContext);
    const ignoredGlobs = listIgnoredGlobs(session, planned.selection.view, ESLINT_CHECK);
    const { configurationBlocks, configurationImports, configurationSelectors } = listConfigurationBlocks(
        session,
        eslintContext,
    );
    const shipped = selectPlugins(eslintContext, boundaryBlocks);
    const plugins = { ...shipped, ...listLocalPlugins(session.scopes, planned.targetPath, shipped) };
    const presets = eslintContext.eslintPresets.get(JAVASCRIPT_CONFIGURATION);
    const capturedImports = Object.fromEntries<readonly [string, string]>(
        [...PRESETS_BEFORE_CONFIGURATIONS, ...PRESETS_AFTER_CONFIGURATIONS].map(([name, importName]) => [
            importName,
            [importName, getPreset(presets, name).package],
        ]),
    );
    const output: string[] = [
        serializeImports({ ...capturedImports, ...plugins }, configurationImports),
        `const runtimeDeclarations = ${JSON.stringify(runtimes, null, JSON_INDENT)};\n`,
        'export default [',
        '    // Shared ignore sections.',
        indentEslintBlock(serializeBlock({ ignores: ignoredGlobs })) + ',',
        serializeBlocks(blockInput, [
            ...buildOpeningBlocks(eslintContext, plugins, boundaryBlocks, ignoredGlobs).map((block) => ({
                ...block,
                label: ESLINT_BASE_LABEL,
            })),
            ...configurationBlocks,
            ...buildClosingBlocks(eslintContext, configurationSelectors, runtimes).map((block) => ({
                ...block,
                label: ESLINT_BASE_LABEL,
            })),
            ...[
                ...buildSelectedBlocks(eslintContext),
                ...buildLocalPluginBlocks(session.scopes, eslintContext.eslintFiles.code),
            ].map((data) => ({ data, label: ESLINT_BASE_LABEL })),
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
