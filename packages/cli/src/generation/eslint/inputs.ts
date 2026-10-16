// The parts of the ESLint configuration that the settings and the emitted scope decide.
import { basename } from 'node:path/posix';
import type { Session } from '#cli/types/planning.ts';
import { getSettingValue } from '#cli/settings/inherit.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/tsconfig.ts';
import { readPresets } from '#cli/generation/eslint/presets.ts';
import { eslintModule } from '#cli/generation/eslint/serialize.ts';
import { generatedIgnores } from '#cli/generation/ignore-files.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import { readScopeAliases } from '#cli/generation/eslint/aliases.ts';
import { JSON_INDENT } from '#cli/config/generation/tool-projects.ts';
import { boundaryBlocks } from '#cli/generation/eslint/boundaries.ts';
import { escapeGlob, buildPathMatcher } from '#cli/repository/matchers.ts';
import { getProjectDependencies } from '#cli/repository/dependency-files.ts';
import { scriptPaths, runtimeBlocks } from '#cli/generation/eslint/runtimes.ts';
import { filePatterns, nodePatterns, sourcePattern } from '#cli/generation/eslint/files.ts';
import { trivialRuleBlocks, environmentRuleBlocks } from '#cli/generation/eslint/structure.ts';
import { ruleOptions, ignoreBlocks, importStyleBlocks, manifestRuleBlocks } from '#cli/generation/eslint/blocks.ts';

import type {
    EslintBlock,
    EslintPresets,
    EslintContext,
    EslintRuleLevels,
    EslintConfiguration,
    EslintFragmentInputs,
} from '#cli/types/generation/eslint.ts';
import {
    CODE_LANGUAGES,
    TEST_RULE_NAMES,
    NODE_SHEBANG_TAG,
    BARREL_FILES_RULE,
    EXPORTS_LAST_RULE,
    IMPORT_LAYOUT_RULES,
    ESLINT_SETTINGS_TABLE,
    IMPORT_BOUNDARIES_RULE,
    ESLINT_BOUNDARY_FOLDERS,
} from '#cli/config/generation/eslint.ts';

// Root and nested rules share the same boundary folders and their project's aliases.
function importBoundariesRule(scopes: ScopeSelection[], aliases: Record<string, string>) {
    const scopePaths = scopes.map((entry) => escapeGlob(entry.scope.path)).filter((path) => path !== '');
    return ['error', { folders: [...ESLINT_BOUNDARY_FOLDERS, ...scopePaths], aliases }];
}

// Each nested scope resolves its import boundaries against its own aliases.
function scopeBlocks(context: EslintContext): EslintBlock[] {
    const { root, reads, scopes, nodeFiles } = context;
    return scopes
        .filter((entry) => entry.scope.path !== '')
        .map((entry) => {
            const path = entry.scope.path;
            const aliases = readScopeAliases(root, path, reads);
            return {
                files: [`${escapeGlob(path)}/${sourcePattern(...CODE_LANGUAGES)}`, ...nodePatterns(nodeFiles, path)],
                rules: {
                    [IMPORT_BOUNDARIES_RULE]: importBoundariesRule(scopes, aliases),
                },
            };
        });
}

// ESLint options and the separate reason you give for them.
function extraBlock(context: EslintContext): EslintConfiguration['extra'] {
    const { settings, selection } = context;
    const entries = selection.view.extra('eslint');
    if (entries === undefined || Object.keys(entries).length === 0) return undefined;
    return {
        reason: getSettingValue(selection.known, settings, 'tools.eslint.extra', selection.scope.path)?.reason,
        entries,
    };
}

/**
 * The parts of the ESLint configuration the settings decides: limits, rule options, file sets, and override blocks.
 *
 * @param context the repository settings, selected scopes, and detected Node file paths.
 * @param projects the parsed dependency files.
 *
 * @returns the values, ready to serialize into the configuration.
 */
function calculateConfiguration(context: EslintContext, projects: string[]): EslintConfiguration {
    const { root, reads, scopes, selection, nodeFiles, settings } = context;
    const { view } = selection;
    const tool = view.options(ESLINT_SETTINGS_TABLE);
    const aliases = readScopeAliases(root, '', reads);
    return {
        projects,
        nodeFiles,
        testFiles: view.test_files,
        scriptFiles: scriptPaths(context),
        restrictedImports: tool.restricted_imports,
        allLevelRules: {
            [IMPORT_BOUNDARIES_RULE]: importBoundariesRule(context.scopes, aliases),
            [EXPORTS_LAST_RULE]: 'error',
            ...IMPORT_LAYOUT_RULES,
            ...(settings.structure.reexports === 'none'
                ? {}
                : {
                      [BARREL_FILES_RULE]: [
                          'error',
                          {
                              amountOfExportsToConsiderModuleAsBarrel: context.selection.view.limit(
                                  'index_exports',
                                  'typescript',
                              ),
                          },
                      ],
                  }),
        },
        importStyleBlocks: importStyleBlocks(scopes, nodeFiles),
        runtimes: runtimeBlocks(scopes),
        boundaryBlocks: boundaryBlocks(context),
        scopeBlocks: scopeBlocks(context),
        ignoredPaths: context.generatedPatterns,
        extra: extraBlock(context),
    };
}

/**
 * Read the rule lists once and prepare file selectors for this generation run.
 *
 * @param session the repository and parsed settings of this run.
 * @param selection the current scope.
 * @param pluginLevels the ESLint plugin rule levels.
 *
 * @returns the data and callbacks for emitting the ESLint assets.
 */
function moduleInputs(session: Session, selection: ScopeSelection, pluginLevels: EslintRuleLevels) {
    const { root, reads, scopes, settingsFile, repository } = session;
    const { settings } = settingsFile;
    const options = ruleOptions(settings);
    const allRules = new Set([
        ...[...session.manifests.values()].flatMap((manifest) => [...manifest.eslint.all_level_rules]),
        ...Object.entries(pluginLevels).flatMap(([name, level]) => (level === 'all' ? [`gspot/${name}`] : [])),
    ]);
    const presets = new Map<string, EslintPresets>();
    const recognized = buildPathMatcher([sourcePattern(...CODE_LANGUAGES)]);
    const nodeFiles = repository.files
        .filter((file) => !recognized(file.path) && file.kind === 'source' && file.tags.includes(NODE_SHEBANG_TAG))
        .map((file) => file.path);
    const eslintFiles = filePatterns({
        components: [],
        nodeFiles,
        tests: selection.view.test_files,
        scripts: scriptPaths({ selection }),
    });
    const context = {
        root,
        reads,
        settings,
        scopes,
        selection,
        nodeFiles,
        generatedPatterns: generatedIgnores(session),
    };
    let configuration: EslintConfiguration | undefined;
    return {
        ruleOptions: options,
        eslint: () =>
            (configuration ??= calculateConfiguration(
                context,
                repository.files.filter((file) => basename(file.path) === TSCONFIG_FILE).map((file) => file.path),
            )),
        settingsBlocks: () => [
            ...environmentRuleBlocks(context),
            ...trivialRuleBlocks(context),
            ...manifestRuleBlocks(scopes),
            ...ignoreBlocks(settings),
        ],
        eslintAllRules: allRules,
        eslintModule: eslintModule({
            allRules,
            isAll: settings.level === 'all',
            codeFiles: eslintFiles.code,
            ruleOptions: options,
        }),
        eslintFiles,
        eslintFragmentBlocks: [],
        eslintPresets: (name: string) => {
            let preset = presets.get(name);
            if (preset !== undefined) return preset;
            preset = readPresets(session.manifests.get(name) as Manifest);
            presets.set(name, preset);
            return preset;
        },
    };
}

/**
 * Prepare repository facts and callbacks used by the typed ESLint fragments.
 *
 * @param session the repository session.
 * @param selection the selected scope and its settings.
 * @param pluginLevels the ESLint plugin rule levels.
 *
 * @returns the typed values used by ESLint fragment builders.
 */
export function eslintInputs(
    session: Session,
    selection: ScopeSelection,
    pluginLevels: EslintRuleLevels,
): EslintFragmentInputs {
    const { settings: repositorySettings } = session.settingsFile;
    const { settings } = selection.view;
    const isAll = repositorySettings.level === 'all';
    return {
        ...moduleInputs(session, selection, pluginLevels),
        configurations: selection.view.configurations,
        settings,
        roles: selection.view.roles,
        testFiles: selection.view.test_files,
        scope: selection.scope.path,
        scopeDependencies: Object.keys(getProjectDependencies(session.packageManifests, selection.scope.path)),
        testRuleNames: TEST_RULE_NAMES,
        isAll,
        repositorySettings,
        files: (extension) =>
            session.repository.files.flatMap((file) =>
                file.kind === 'source' && file.path.endsWith(extension) ? [file.path] : [],
            ),
        json: (value, indent = JSON_INDENT) => JSON.stringify(value, null, indent),
    };
}
