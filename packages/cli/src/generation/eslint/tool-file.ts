// Build the ESLint tool file from the settings and the scope.
import { GspotError } from '#cli/system/errors.ts';
import { getPreset } from '#cli/generation/eslint/presets.ts';
import { JSON_INDENT } from '#cli/config/generation/generate.ts';
import { buildRuntimes } from '#cli/generation/eslint/runtimes.ts';
import type { BlockWriter } from '#cli/types/generation/eslint.ts';
import { type PlannedToolFile } from '#cli/types/generation/files.ts';
import { ESLINT_INDENT } from '#cli/config/generation/eslint/print.ts';
import { buildPlannedEslintFile } from '#cli/generation/eslint/plan.ts';
import { JAVASCRIPT_CONFIGURATION } from '#cli/config/configurations.ts';
import { buildBoundaryBlocks } from '#cli/generation/eslint/boundaries.ts';
import { ESLINT_CHECK } from '#cli/config/generation/eslint/settings-blocks.ts';
import { buildSelectedBlocks } from '#cli/generation/eslint/settings-blocks.ts';
import { serializeBlock, serializeImports } from '#cli/generation/eslint/print.ts';
import { listConfigurationBlocks } from '#cli/generation/eslint/configurations/build.ts';
import { writeEslintBlock, listUnappliedRules } from '#cli/generation/eslint/block-writer.ts';
import { listLocalPlugins, buildLocalPluginBlocks } from '#cli/generation/eslint/local-plugins.ts';
import { selectPlugins, buildClosingBlocks, buildOpeningBlocks } from '#cli/generation/eslint/base.ts';
import { convertToGlobs, buildIgnoreSections, listCheckIgnoreSections } from '#cli/generation/settings/ignore-files.ts';

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

    const eslintFile = buildPlannedEslintFile(planned);
    const { blockWriter } = eslintFile;
    const runtimes = buildRuntimes(session.scopes);
    const boundaryBlocks = buildBoundaryBlocks(eslintFile);
    const ignoredGlobs = convertToGlobs([
        ...buildIgnoreSections(session),
        ...listCheckIgnoreSections(planned.scope.settings, ESLINT_CHECK),
    ]);
    const { configurationBlocks, configurationImports, configurationSelectors } = listConfigurationBlocks(
        session,
        eslintFile,
    );
    const shipped = selectPlugins(eslintFile, boundaryBlocks);
    const plugins = { ...shipped, ...listLocalPlugins(session.scopes, planned.targetPath, shipped) };
    const presets = eslintFile.eslintPresets.get(JAVASCRIPT_CONFIGURATION);
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
        serializeBlock({ ignores: ignoredGlobs })
            .split('\n')
            .map((line) => ESLINT_INDENT + line)
            .join('\n') + ',',
        [
            ...buildOpeningBlocks(eslintFile, plugins, boundaryBlocks, ignoredGlobs).map((block) => ({
                ...block,
                label: ESLINT_BASE_LABEL,
            })),
            ...configurationBlocks,
            ...buildClosingBlocks(eslintFile, configurationSelectors, runtimes).map((block) => ({
                ...block,
                label: ESLINT_BASE_LABEL,
            })),
            ...[
                ...buildSelectedBlocks(eslintFile),
                ...buildLocalPluginBlocks(session.scopes, eslintFile.eslintFiles.code),
            ].map((data) => ({ data, label: ESLINT_BASE_LABEL })),
        ]
            .map((block) => writeEslintBlock(blockWriter, block))
            .join(',\n') + ',',
        '];',
        '',
    ];
    assertRulesRun(session, blockWriter);
    return output.join('\n');
}

// gspot writes rule options only for the rules that run at the level of the repository.
function assertRulesRun(session: PlannedToolFile['session'], writer: BlockWriter): void {
    const unapplied = listUnappliedRules(writer);
    if (unapplied.length === 0) return;
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
