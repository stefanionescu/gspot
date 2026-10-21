import { basename } from 'node:path/posix';
import { listAssets } from '#cli/system/assets.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/tsconfig.ts';
import { readPresets } from '#cli/generation/eslint/presets.ts';
import { buildLevelRules } from '#cli/generation/eslint/base.ts';
import { listScriptPaths } from '#cli/generation/eslint/runtimes.ts';
import { CONFIGURATIONS_FOLDER } from '#cli/config/configurations.ts';
import type { ToolFileContext } from '#cli/types/generation/files.ts';
import { NODE_SHEBANG_TAG } from '#cli/config/repository/inventory.ts';
import { BASE_SELECTORS } from '#cli/config/generation/eslint-rules.ts';
import type { EslintPresets, EslintContext } from '#cli/types/generation/eslint.ts';
import { CODE_LANGUAGES, ESLINT_PRESETS_FILE } from '#cli/config/generation/eslint.ts';
import { listFragmentConfigurations } from '#cli/generation/eslint/fragments/build.ts';
import { buildFilePatterns, buildSourcePattern } from '#cli/generation/eslint/files.ts';

import {
    buildRuleOptions,
    buildIgnoreBlocks,
    buildRulesOffBlocks,
    buildTrivialRuleBlocks,
    buildEnvironmentRuleBlocks,
} from '#cli/generation/eslint/lint-rules.ts';

// Read each shipped configuration preset once per process.
function readEslintPresets(session: ToolFileContext['session']): Map<string, EslintPresets> {
    return new Map(
        [...session.manifests.values()]
            .filter((manifest) => presetAssets.has(`${manifest.folder}/${ESLINT_PRESETS_FILE}`))
            .map((manifest): [string, EslintPresets] => {
                let presets = presetInputs.get(manifest);
                if (presets === undefined) {
                    presets = readPresets(manifest);
                    presetInputs.set(manifest, presets);
                }
                return [manifest.configuration.name, presets];
            }),
    );
}

/**
 * Build the ESLint context of one scope.
 *
 * @param input the tool file to build.
 * @returns the context that the ESLint file needs.
 */
function buildEslintContext(input: ToolFileContext): EslintContext {
    const { session, selection, toolFile } = input;
    const { view } = selection;
    const { scopes } = session;
    const repositorySettings = session.settingsFile.settings;
    const { level } = repositorySettings;
    const recognized = buildPathMatcher([buildSourcePattern(...CODE_LANGUAGES)]);
    const nodeFiles = session.repository.files
        .filter((file) => !recognized(file.path) && file.kind === 'source' && file.tags.includes(NODE_SHEBANG_TAG))
        .map((file) => file.path);
    const configurations = listFragmentConfigurations(scopes, selection, toolFile);
    const context = { session, nodeFiles };
    const options = buildRuleOptions(repositorySettings, scopes);
    const allRules = new Set(
        [...session.manifests.values()].flatMap((manifest) => [...manifest.eslint.all_level_rules]),
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
        eslintAllRules: allRules,
        blockInput: {
            applied: new Set(),
            allRules,
            level,
            codeFiles: eslintFiles.code,
            ruleOptions: options,
        },
        eslintFiles,
        eslintPresets: readEslintPresets(session),
        configurations,
    };
}

const presetInputs = new Map<Manifest, EslintPresets>();

const presetAssets = new Set(listAssets(CONFIGURATIONS_FOLDER));

export { buildEslintContext };
