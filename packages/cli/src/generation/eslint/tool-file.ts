import { GspotError } from '#cli/system/errors.ts';
import { getPreset } from '#cli/generation/eslint/presets.ts';
import { JSON_INDENT } from '#cli/config/generation/generate.ts';
import { buildRuntimes } from '#cli/generation/eslint/runtimes.ts';
import { type PlannedToolFile } from '#cli/types/generation/files.ts';
import { ESLINT_INDENT } from '#cli/config/generation/eslint/print.ts';
import { buildPlannedEslintFile } from '#cli/generation/eslint/plan.ts';
import { JAVASCRIPT_CONFIGURATION } from '#cli/config/configurations.ts';
import { buildBoundaryBlocks } from '#cli/generation/eslint/boundaries.ts';
import { ESLINT_CHECK } from '#cli/config/generation/eslint/settings-blocks.ts';
import { buildSelectedBlocks } from '#cli/generation/eslint/settings-blocks.ts';
import type { BlockWriter, EslintPresets } from '#cli/types/generation/eslint.ts';
import { serializeBlock, serializeImports } from '#cli/generation/eslint/print.ts';
import { listConfigurationBlocks } from '#cli/generation/eslint/configurations/build.ts';
import { writeEslintBlock, listUnappliedRules } from '#cli/generation/eslint/block-writer.ts';
import { listLocalPlugins, buildLocalPluginBlocks } from '#cli/generation/eslint/local-plugins.ts';
import { selectPlugins, buildClosingBlocks, buildOpeningBlocks } from '#cli/generation/eslint/base.ts';
import { convertToGlobs, buildIgnoreSections, listCheckIgnoreSections } from '#cli/generation/settings/ignore-files.ts';

import {
    ESLINT_BASE_LABEL,
    RULE_PLUGIN_PREFIX,
    PRESETS_AFTER_CONFIGURATIONS,
    PRESETS_BEFORE_CONFIGURATIONS,
} from '#cli/config/generation/eslint/base.ts';

/**
 * Build the ESLint file from the presets, lint rules, and configuration blocks.
 *
 * @param planned the tool file with its scope, level, and target path.
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
        '    // Files that ESLint skips.',
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
    assertRulesRun(blockWriter, [...Object.keys(plugins), ...listPresetRules(eslintFile.eslintPresets)]);
    return output.join('\n');
}

// The rule names of every pinned preset, which name the plugins that the presets bring.
function listPresetRules(presets: Map<string, EslintPresets>): string[] {
    const blocks = [...presets.values()].flatMap((entry) => Object.values(entry).flatMap((preset) => preset.blocks));
    return blocks.flatMap((block) => (block.rules === undefined ? [] : Object.keys(block.rules)));
}

// gspot writes rule options only for the rules that run at the level of the repository. The refusal names its case:
// a rule of level all, a rule that gspot has and runs at no level, or a rule of no plugin that gspot has.
function assertRulesRun(writer: BlockWriter, ruleNames: string[]): void {
    const unapplied = listUnappliedRules(writer);
    if (unapplied.length === 0) return;
    const pluginPrefixes = new Set(['', ...ruleNames.map((rule) => RULE_PLUGIN_PREFIX.exec(rule)?.[1] ?? rule)]);
    throw new GspotError(
        'settings',
        unapplied
            .map((rule) => {
                if (writer.level !== 'all' && writer.allLevelRules.has(rule))
                    return `${rule} runs only at level all. gspot sets options only for the rules that run at level recommended.`;
                return pluginPrefixes.has(RULE_PLUGIN_PREFIX.exec(rule)?.[1] ?? '')
                    ? `gspot runs ${rule} at no level, so it takes no options. For a rule of your own, add a [[tools.eslint.plugins]] record.`
                    : `${rule} belongs to no plugin that gspot loads. For a rule of your own, add a [[tools.eslint.plugins]] record.`;
            })
            .join('\n'),
    );
}
