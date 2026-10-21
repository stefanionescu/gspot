import { basename } from 'node:path/posix';
import { listAssets } from '#cli/system/assets.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/tsconfig.ts';
import { readPresets } from '#cli/generation/eslint/presets.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { buildLevelRules } from '#cli/generation/eslint/base.ts';
import { listScriptPaths } from '#cli/generation/eslint/runtimes.ts';
import { CONFIGURATIONS_FOLDER } from '#cli/config/configurations.ts';
import type { PlannedToolFile } from '#cli/types/generation/files.ts';
import { NODE_SHEBANG_TAG } from '#cli/config/repository/inventory.ts';
import { CODE_LANGUAGES } from '#cli/config/generation/eslint/files.ts';
import { BASE_SELECTORS } from '#cli/config/generation/eslint/rules.ts';
import type { ToolFile, Configuration } from '#cli/types/configurations.ts';
import { ESLINT_PRESETS_FILE } from '#cli/config/generation/eslint/presets.ts';
import { buildFilePatterns, buildSourcePattern } from '#cli/generation/eslint/files.ts';
import type { EslintPresets, PlannedEslintFile } from '#cli/types/generation/eslint.ts';

import {
    buildRuleOptions,
    buildIgnoreBlocks,
    buildRulesOffBlocks,
    buildTrivialRuleBlocks,
    buildEnvironmentRuleBlocks,
} from '#cli/generation/eslint/settings-blocks.ts';

const PRESETS_BY_CONFIGURATION = new Map<Configuration, EslintPresets>();

const PRESET_ASSET_PATHS = new Set(listAssets(CONFIGURATIONS_FOLDER));

/**
 * Select the configurations whose fragments add to this tool file.
 * A tool file for one scope asks that scope; a tool file written once asks every scope.
 *
 * @param scopes every project and its settings.
 * @param selection the scope that gets the tool file.
 * @param target the tool file declaration and its scope requirements.
 * @returns each configuration with a fragment for this tool file, once.
 */
function listToolFileConfigurations(scopes: Scope[], selection: Scope, target: ToolFile): Configuration[] {
    if (target.per_scope) return selection.selected;
    const every = [selection, ...scopes].flatMap((entry) => entry.selected);
    return new Map(every.map((configuration) => [configuration.name, configuration])).values().toArray();
}

// Read each shipped configuration preset once per process.
function readEslintPresets(session: PlannedToolFile['session']): Map<string, EslintPresets> {
    return new Map(
        [...session.configurations.values()]
            .filter((configuration) => PRESET_ASSET_PATHS.has(`${configuration.folder}/${ESLINT_PRESETS_FILE}`))
            .map((configuration): [string, EslintPresets] => {
                let presets = PRESETS_BY_CONFIGURATION.get(configuration);
                if (presets === undefined) {
                    presets = readPresets(configuration);
                    PRESETS_BY_CONFIGURATION.set(configuration, presets);
                }
                return [configuration.name, presets];
            }),
    );
}

/**
 * Build the ESLint context of one scope.
 *
 * @param planned the tool file to build.
 * @returns the context that the ESLint file needs.
 */
export function buildPlannedEslintFile(planned: PlannedToolFile): PlannedEslintFile {
    const { session, selection, toolFile } = planned;
    const { view } = selection;
    const { scopes } = session;
    const repositorySettings = session.settingsFile.settings;
    const { level } = repositorySettings;
    const recognized = buildPathMatcher([buildSourcePattern(...CODE_LANGUAGES)]);
    const nodeFiles = session.repository.files
        .filter((file) => !recognized(file.path) && file.kind === 'source' && file.tags.includes(NODE_SHEBANG_TAG))
        .map((file) => file.path);
    const configurations = listToolFileConfigurations(scopes, selection, toolFile);
    const context = { session, nodeFiles };
    const options = buildRuleOptions(repositorySettings, scopes);
    const allLevelRules = new Set(
        [...session.configurations.values()].flatMap((configuration) => [...configuration.eslint.all_level_rules]),
    );
    const eslintFiles = buildFilePatterns({
        components: configurations,
        nodeFiles,
        scopes: scopes.map((selection) => ({
            scope: selection.scope.path,
            tests: selection.view.test_files,
            scripts: listScriptPaths(selection),
        })),
    });
    return {
        ...context,
        selection,
        level,
        projects: session.repository.files
            .filter((file) => basename(file.path) === TSCONFIG_FILE)
            .map((file) => file.path),
        ruleOptions: options,
        levelRules: buildLevelRules(view, level === 'all' ? BASE_SELECTORS : []),
        settingsBlocks: [
            ...buildEnvironmentRuleBlocks(context),
            ...buildTrivialRuleBlocks(context),
            ...buildRulesOffBlocks(scopes),
            ...buildIgnoreBlocks(repositorySettings),
        ],
        allLevelRules: allLevelRules,
        blockInput: {
            applied: new Set(),
            allLevelRules,
            level,
            codeFiles: eslintFiles.code,
            ruleOptions: options,
        },
        eslintFiles,
        eslintPresets: readEslintPresets(session),
        configurations,
    };
}
