import { z } from 'zod';
import { basename } from 'node:path/posix';
import type { MemoKey } from '#cli/types/system/files.ts';
import { getSettingValue } from '#cli/settings/inherit.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { readAsset, listAssets } from '#cli/system/assets.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/tsconfig.ts';
import { readPresets } from '#cli/generation/eslint/presets.ts';
import { generatedIgnores } from '#cli/generation/ignore-files.ts';
import { readScopeAliases } from '#cli/generation/eslint/aliases.ts';
import { JSON_INDENT } from '#cli/config/generation/tool-projects.ts';
import type { ToolFileContext } from '#cli/types/generation/files.ts';
import { createBlockWriter } from '#cli/generation/eslint/block-writer.ts';
import { buildBoundaryBlocks } from '#cli/generation/eslint/boundaries.ts';
import { getProjectDependencies } from '#cli/repository/dependency-files.ts';
import { LEVELS, CONFIGURATIONS_FOLDER } from '#cli/config/configurations.ts';
import { getCachedValue, getCachedMapValue } from '#cli/system/files/cache.ts';
import { listFragmentConfigurations } from '#cli/generation/eslint/fragments/build.ts';
import { buildFilePatterns, buildSourcePattern } from '#cli/generation/eslint/files.ts';
import { listScriptPaths, buildRuntimeBlocks } from '#cli/generation/eslint/runtimes.ts';

import {
    buildImportStyleBlocks,
    buildScopeImportBlocks,
    buildImportBoundariesRule,
} from '#cli/generation/eslint/imports.ts';
import type {
    EslintParts,
    EslintFacts,
    EslintPresets,
    EslintContext,
    EslintRuleLevels,
} from '#cli/types/generation/eslint.ts';
import {
    buildRuleOptions,
    buildIgnoreBlocks,
    buildRulesOffBlocks,
    buildTrivialRuleBlocks,
    buildEnvironmentRuleBlocks,
} from '#cli/generation/eslint/lint-rules.ts';
import {
    CODE_LANGUAGES,
    TEST_RULE_NAMES,
    NODE_SHEBANG_TAG,
    BARREL_FILES_RULE,
    EXPORTS_LAST_RULE,
    IMPORT_LAYOUT_RULES,
    ESLINT_PRESETS_FILE,
    ESLINT_SETTINGS_TABLE,
    IMPORT_BOUNDARIES_RULE,
    ESLINT_RULE_LEVELS_FILE,
} from '#cli/config/generation/eslint.ts';

// ESLint options and the separate reason you give for them.
function buildExtraBlock(context: Pick<EslintContext, 'repositorySettings' | 'selection'>): EslintParts['extra'] {
    const { repositorySettings: settings, selection } = context;
    const entries = selection.view.extra('eslint');
    if (entries === undefined || Object.keys(entries).length === 0) return undefined;
    return {
        reason: getSettingValue(selection.known, settings, 'tools.eslint.extra', selection.scope.path)?.reason,
        entries,
    };
}
function buildEslintFacts({ session, selection }: ToolFileContext): EslintFacts {
    const recognized = buildPathMatcher([buildSourcePattern(...CODE_LANGUAGES)]);
    const nodeFiles = session.repository.files
        .filter((file) => !recognized(file.path) && file.kind === 'source' && file.tags.includes(NODE_SHEBANG_TAG))
        .map((file) => file.path);
    return {
        root: session.root,
        reads: session.reads,
        scopes: session.scopes,
        repositorySettings: session.settingsFile.settings,
        selection,
        nodeFiles,
        generatedPatterns: generatedIgnores(session),
    };
}

function readEslintPresets(session: ToolFileContext['session']): Map<string, EslintPresets> {
    const { reads } = session;
    const assets = getCachedValue(reads, presetAssets);
    return new Map(
        [...session.manifests.values()]
            .filter(
                (manifest) =>
                    Object.keys(manifest.eslint.presets).length > 0 ||
                    assets.has(`${manifest.dir}/${ESLINT_PRESETS_FILE}`),
            )
            .map((manifest) => [
                manifest.configuration.name,
                getCachedMapValue(reads, presetInputs, manifest, () => readPresets(manifest)),
            ]),
    );
}

function buildProjectOptions(session: ToolFileContext['session'], context: EslintFacts): EslintParts {
    const { root, reads, scopes, selection, nodeFiles, repositorySettings } = context;
    const { view } = selection;
    const repository = session.repository;
    const tool = view.options(ESLINT_SETTINGS_TABLE);
    const aliases = readScopeAliases(root, '', reads);
    return {
        projects: repository.files.filter((file) => basename(file.path) === TSCONFIG_FILE).map((file) => file.path),
        nodeFiles,
        testFiles: view.test_files,
        scriptFiles: listScriptPaths(context),
        restrictedImports: tool.restricted_imports,
        allLevelRules: {
            [IMPORT_BOUNDARIES_RULE]: buildImportBoundariesRule(context.scopes, aliases),
            [EXPORTS_LAST_RULE]: 'error',
            ...IMPORT_LAYOUT_RULES,
            ...(repositorySettings.structure.reexports === 'none'
                ? {}
                : {
                      [BARREL_FILES_RULE]: [
                          'error',
                          {
                              amountOfExportsToConsiderModuleAsBarrel: selection.view.limit(
                                  'index_exports',
                                  'typescript',
                              ),
                          },
                      ],
                  }),
        },
        importStyleBlocks: buildImportStyleBlocks(scopes, nodeFiles),
        runtimes: buildRuntimeBlocks(scopes),
        boundaryBlocks: buildBoundaryBlocks(context),
        scopeBlocks: buildScopeImportBlocks(context),
        ignoredPaths: context.generatedPatterns,
        extra: buildExtraBlock(context),
    };
}

/**
 * Compute the repository facts, selected rule blocks, and printers used by this scope's ESLint file.
 * @param input the repository, selected scope, and ESLint tool-file declaration.
 * @returns the scope facts, selected presets, rule blocks, and printers.
 */
function buildEslintContext(input: ToolFileContext): EslintContext {
    const { session, selection, toolFile } = input;
    const context = buildEslintFacts(input);
    const { reads, scopes, repositorySettings, nodeFiles } = context;
    const repository = session.repository;
    const pluginLevels = getCachedValue(reads, pluginRuleLevels);
    const view = selection.view;
    const options = buildRuleOptions(repositorySettings);
    const allRules = new Set([
        ...[...session.manifests.values()].flatMap((manifest) => [...manifest.eslint.all_level_rules]),
        ...Object.entries(pluginLevels).flatMap(([name, level]) => (level === 'all' ? [`gspot/${name}`] : [])),
    ]);
    const eslintFiles = buildFilePatterns({
        components: listFragmentConfigurations(scopes, selection, toolFile),
        nodeFiles,
        tests: view.test_files,
        scripts: listScriptPaths({ selection }),
    });
    return {
        ...context,
        pluginLevels,
        ruleOptions: options,
        eslint: buildProjectOptions(session, context),
        settingsBlocks: [
            ...buildEnvironmentRuleBlocks(context),
            ...buildTrivialRuleBlocks(context),
            ...buildRulesOffBlocks(scopes),
            ...buildIgnoreBlocks(repositorySettings),
        ],
        eslintAllRules: allRules,
        eslintModule: createBlockWriter({
            allRules,
            isAll: repositorySettings.level === 'all',
            codeFiles: eslintFiles.code,
            ruleOptions: options,
        }),
        eslintFiles,
        eslintPresets: readEslintPresets(session),
        configurations: view.configurations,
        settings: view.settings,
        roles: view.roles,
        testFiles: view.test_files,
        scope: selection.scope.path,
        scopeDependencies: Object.keys(getProjectDependencies(session.packageManifests, selection.scope.path)),
        testRuleNames: TEST_RULE_NAMES,
        isAll: repositorySettings.level === 'all',
        files: (extension) =>
            repository.files.flatMap((file) =>
                file.kind === 'source' && file.path.endsWith(extension) ? [file.path] : [],
            ),
        json: (value) => JSON.stringify(value, null, JSON_INDENT),
    };
}

const pluginRuleLevelsSchema = z.record(
    z.string(),
    z.enum(LEVELS).or(z.literal('none')),
) satisfies z.ZodType<EslintRuleLevels>;
const pluginRuleLevels: MemoKey<EslintRuleLevels> = {
    create: () => pluginRuleLevelsSchema.parse(JSON.parse(readAsset(ESLINT_RULE_LEVELS_FILE))),
};
const presetInputs: MemoKey<Map<Manifest, EslintPresets>> = { create: () => new Map() };

const presetAssets: MemoKey<Set<string>> = { create: () => new Set(listAssets(CONFIGURATIONS_FOLDER)) };

export { buildEslintContext };
