import { basename } from 'node:path/posix';

import {
    BOUNDARIES_FILES_SETTING,
    GSPOT_PRESET_LEVELS,
    GSPOT_RULE_PREFIX,
    IMPORT_BOUNDARIES_RULE,
    IMPORT_LAYOUT_RULES,
    PRESETS_AFTER_CONFIGURATIONS,
    PRESETS_BEFORE_CONFIGURATIONS,
    RESTRICTED_SYNTAX_RULE,
    TEST_RULES,
} from '#cli/config/configurations/javascript/eslint-blocks.ts';
import { CONSOLE_RULES, JAVASCRIPT_RULES, SCRIPT_RULES } from '#cli/config/configurations/javascript/eslint-rules.ts';
import { DENO_CONFIG_FILES } from '#cli/config/configurations/shared.ts';
import { readScopeAliases } from '#cli/configurations/language/javascript/aliases.ts';
import {
    buildImportBoundariesRule,
    buildImportIgnores,
    buildImportStyleBlocks,
    buildNodeScriptBlocks,
    buildRestrictedImportBlocks,
    buildScopeImportBlocks,
} from '#cli/configurations/language/javascript/eslint/blocks/imports.ts';
import { buildLocalPluginBlocks } from '#cli/configurations/language/javascript/eslint/blocks/local-plugins.ts';
import { buildPackageJsonBlocks } from '#cli/configurations/language/javascript/eslint/blocks/package-json.ts';
import { buildRuntimeBlocks } from '#cli/configurations/language/javascript/eslint/blocks/runtimes.ts';
import { buildSelectorBlocks } from '#cli/configurations/language/javascript/eslint/blocks/selectors.ts';
import { splitSettingsBlocks } from '#cli/configurations/language/javascript/eslint/blocks/settings.ts';
import { buildScopeFiles } from '#cli/configurations/language/javascript/eslint/files.ts';
import { listNestedScopeGlobs } from '#cli/configurations/language/javascript/eslint/scopes.ts';
import {
    listCodePatterns,
    listJavascriptScopes,
    listScriptFiles,
} from '#cli/configurations/language/javascript/sources.ts';
import { extractParentFolder } from '#cli/system/paths.ts';
import type {
    ConfigurationBlocks,
    EslintBlock,
    EslintBlockFields,
    ListedPlugins,
    PlannedEslintFile,
} from '#cli/types/configurations/javascript.ts';

function buildProjectBlocks(planned: PlannedEslintFile, boundaryBlocks: EslintBlock[]): ConfigurationBlocks {
    const { session, projects } = planned;
    return [
        ...buildImportStyleBlocks(
            session.scopes,
            planned.nodeFiles,
            new Set(
                session.repository.files
                    .filter((file) => (DENO_CONFIG_FILES as readonly string[]).includes(basename(file.path)))
                    .map((file) => extractParentFolder(file.path)),
            ),
        ),
        ...buildScopeImportBlocks(planned),
        ...buildNodeScriptBlocks(planned),
        ...boundaryBlocks,
    ].map((fields) => ({
        fields,
        ...(fields.settings?.[BOUNDARIES_FILES_SETTING] !== undefined && {
            calls: [{ name: 'setBoundaryLookup', args: [{ value: projects }] }],
        }),
    }));
}

function buildRootBlock(
    planned: PlannedEslintFile,
    plugins: ListedPlugins,
    boundaryBlocks: EslintBlock[],
    ignoredGlobs: string[],
): ConfigurationBlocks[number] {
    const { eslintFiles, session, blockWriter } = planned;
    const rules = planned.languageRules;
    const pluginOptions = Object.fromEntries(
        blockWriter.ruleOptions.flatMap(({ rules }) =>
            Object.keys(rules)
                .filter((name) => name.startsWith(GSPOT_RULE_PREFIX))
                .map((name) => [name, 'error']),
        ),
    );
    return {
        fields: {
            files: eslintFiles.code,
            linterOptions: { reportUnusedDisableDirectives: blockWriter.level === 'all' ? 'error' : 'off' },
            languageOptions: { ecmaVersion: 'latest' },
            settings: { 'import-x/ignore': buildImportIgnores(ignoredGlobs) },
            rules: {
                ...rules.code,
                ...pluginOptions,
                [IMPORT_BOUNDARIES_RULE]: buildImportBoundariesRule(
                    session.scopes,
                    readScopeAliases(session.root, '', session.cache),
                ),
                ...IMPORT_LAYOUT_RULES,
            },
        },
        calls: [
            { name: 'addPlugins', args: [plugins] },
            { name: 'setRuntime', args: [{ package: 'globals' }, { value: 'es2024' }, { value: 'module' }] },
            {
                name: 'setRootFolder',
                args: [
                    {
                        value: [
                            ['settings', 'gspot', 'root'],
                            ...(boundaryBlocks.length > 0 ? [['settings', 'boundaries/root-path']] : []),
                        ],
                    },
                ],
            },
        ],
        presets: [
            {
                package: '@gspothq/eslint-plugin',
                path: `configs.${GSPOT_PRESET_LEVELS[blockWriter.level]}`,
                merge: 'rules',
            },
        ],
    };
}

function buildConsoleBlocks(planned: Pick<PlannedEslintFile, 'session' | 'eslintFiles'>): EslintBlockFields[] {
    const scopes = listJavascriptScopes(planned.session.scopes);
    return scopes.map((scope) => ({
        files: buildScopeFiles(planned.eslintFiles.code, scope.path, ['**/*']),
        ignores: [
            ...listNestedScopeGlobs(
                scopes.map(({ path }) => path),
                scope.path,
            ),
            ...listCodePatterns(scope.settings.test_files),
            ...listScriptFiles(scope),
        ],
        rules: CONSOLE_RULES,
    }));
}

export function buildOpeningBlocks(
    planned: PlannedEslintFile,
    plugins: ListedPlugins,
    boundaryBlocks: EslintBlock[],
    ignoredGlobs: string[],
): ConfigurationBlocks {
    const { eslintFiles } = planned;
    return [
        ...PRESETS_BEFORE_CONFIGURATIONS.map((preset) => ({
            fields: { files: eslintFiles.code },
            presets: [
                {
                    package: preset.package,
                    path: planned.blockWriter.level === 'all' && 'allPath' in preset ? preset.allPath : preset.path,
                    merge: 'fields' as const,
                },
            ],
        })),
        buildRootBlock(planned, plugins, boundaryBlocks, ignoredGlobs),
        {
            fields: { files: eslintFiles.javascript, rules: JAVASCRIPT_RULES },
        },
        ...buildProjectBlocks(planned, boundaryBlocks),
        ...buildRestrictedImportBlocks(planned).map((block): ConfigurationBlocks[number] => ({
            fields: block,
        })),
    ];
}

export function buildClosingBlocks(planned: PlannedEslintFile): ConfigurationBlocks {
    const { eslintFiles, session } = planned;
    const { level, runtimes, allLevelRules } = planned.blockWriter;
    const rules = planned.languageRules;
    const selectorGroups = buildSelectorBlocks(session.scopes, level, session.repository.dependencyFiles);
    return [
        ...buildRuntimeBlocks(eslintFiles, runtimes),
        ...selectorGroups
            .filter((group) => group.selectors.length > 0)
            .map((group): ConfigurationBlocks[number] => ({
                fields: {
                    files: buildScopeFiles(eslintFiles.code, group.scopePath, ['**/*']),
                    ignores: group.ignoredScopes,
                    rules: { [RESTRICTED_SYNTAX_RULE]: ['error', ...group.selectors] },
                },
            })),
        ...buildConsoleBlocks(planned).map((block): ConfigurationBlocks[number] => ({
            fields: block,
        })),
        { fields: { files: eslintFiles.scripts, rules: SCRIPT_RULES } },
        { fields: { files: eslintFiles.tests, rules: TEST_RULES } },
        ...PRESETS_AFTER_CONFIGURATIONS.map((preset) => ({
            fields: { files: 'files' in preset ? [...preset.files] : eslintFiles.code },
            presets: [{ ...preset, merge: 'fields' as const }],
        })),
        ...buildPackageJsonBlocks(planned),
        {
            fields: {
                files: eslintFiles.javascript,
                rules: rules.javascript,
            },
        },
        ...[...splitSettingsBlocks(planned), ...buildLocalPluginBlocks(session.scopes, eslintFiles.code)].map(
            (fields) => ({ fields }),
        ),
        ...(level === 'all'
            ? []
            : [{ fields: { rules: Object.fromEntries([...allLevelRules].map((rule) => [rule, 'off'])) } }]),
    ];
}
