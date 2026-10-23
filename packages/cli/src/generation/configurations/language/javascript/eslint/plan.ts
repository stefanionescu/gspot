import { basename } from 'node:path/posix';
import { listAssets } from '#cli/system/assets.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { BACKSLASH_BEFORE_MATCH } from '#cli/config/text.ts';
import { MISE_SCRIPT_PATH } from '#cli/config/files/names.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { buildPathMatcher } from '#cli/repository/files/matchers.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/projects/tsconfig.ts';
import { CONFIGURATIONS_FOLDER } from '#cli/config/configurations/names.ts';
import { NODE_SHEBANG_TAG } from '#cli/config/repository/files/classify.ts';
import { GLOB_SPECIAL_CHARACTERS } from '#cli/config/files/path-patterns.ts';
import type { ConfigFile, Configuration } from '#cli/types/configurations.ts';
import { readPresets } from '#cli/generation/configurations/language/javascript/eslint/presets.ts';
import { buildLevelRules } from '#cli/generation/configurations/language/javascript/eslint/blocks/base.ts';
import { ESLINT_PRESETS_FILE } from '#cli/config/generation/configurations/language/javascript/eslint/presets.ts';
import { type EslintPresets, type EslintRuleBlock, type PlannedEslintFile } from '#cli/types/generation/eslint.ts';

import {
    splitGlobs,
    buildFilePatterns,
    buildSourcePattern,
} from '#cli/generation/configurations/language/javascript/eslint/files.ts';
import {
    ESLINT_CHECK,
    BASE_SELECTORS,
    CODE_LANGUAGES,
} from '#cli/config/generation/configurations/language/javascript/eslint/config-file.ts';
import {
    buildRuleOptions,
    buildRulesOffBlocks,
    buildTrivialRuleBlocks,
    buildEnvironmentRuleBlocks,
} from '#cli/generation/configurations/language/javascript/eslint/blocks/settings.ts';

const PRESETS_BY_CONFIGURATION = new Map<Configuration, EslintPresets>();

const PRESET_ASSET_PATHS = new Set(listAssets(CONFIGURATIONS_FOLDER));

/**
 * Select the configurations that may add blocks to this config file. A config file per scope takes those of the scope; a
 * config file written once takes those of every scope.
 *
 * @param scopes every project and its settings.
 * @param scope the scope that gets the config file.
 * @param configFile the config file declaration and its scope requirements.
 * @returns each of those configurations, once.
 */
function listConfigFileConfigurations(scopes: Scope[], scope: Scope, configFile: ConfigFile): Configuration[] {
    if (configFile.per_scope) return scope.configurations;
    const every = [scope, ...scopes].flatMap((entry) => entry.configurations);
    return new Map(every.map((configuration) => [configuration.name, configuration])).values().toArray();
}

// Read each shipped configuration preset once per process.
function readEslintPresets(session: PlannedConfigFile['session']): Map<string, EslintPresets> {
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

// The blocks that gspot.toml writes: runtime environments, trivial-code limits, rules turned off, and ignored rules.
function buildSettingsBlocks(planned: Pick<PlannedEslintFile, 'session' | 'nodeFiles'>): EslintRuleBlock[] {
    const { session } = planned;
    const ignored = session.settingsFile.settings.ignore.flatMap((entry): EslintRuleBlock[] =>
        entry.rule === undefined || entry.check !== ESLINT_CHECK
            ? []
            : [
                  {
                      scope: '',
                      ...splitGlobs(entry.paths === undefined || entry.paths.length === 0 ? ['**/*'] : entry.paths),
                      rules: { [entry.rule]: 'off' },
                  },
              ],
    );
    return [
        ...buildEnvironmentRuleBlocks(planned),
        ...buildTrivialRuleBlocks(planned),
        ...buildRulesOffBlocks(session.scopes),
        ...ignored,
    ];
}

/**
 * Collect what the ESLint config file of one scope needs: its file patterns, presets, rule options, and settings blocks.
 *
 * @param planned the config file to build.
 * @returns the scopes, presets, rule options, and settings blocks of the ESLint file.
 */
export function buildPlannedEslintFile(planned: PlannedConfigFile): PlannedEslintFile {
    const { session, scope, configFile } = planned;
    const { settings } = scope;
    const { scopes } = session;
    const repositorySettings = session.settingsFile.settings;
    const { level } = repositorySettings;
    const recognized = buildPathMatcher([buildSourcePattern(...CODE_LANGUAGES)]);
    const nodeFiles = session.repository.files
        .filter((file) => !recognized(file.path) && file.kind === 'source' && file.tags.includes(NODE_SHEBANG_TAG))
        .map((file) => file.path);
    const configurations = listConfigFileConfigurations(scopes, scope, configFile);
    const options = buildRuleOptions(repositorySettings, scopes);
    const allLevelRules = new Set(
        [...session.configurations.values()].flatMap((configuration) => [...configuration.eslint.all_level_rules]),
    );
    const eslintFiles = buildFilePatterns({
        components: configurations,
        nodeFiles,
        scopes: scopes.map((entry) => ({
            scope: entry.folder.path,
            tests: entry.settings.test_files,
            scripts: [
                ...(entry.settings.values.javascript?.script_files ?? []),
                joinScope(
                    entry.folder.path.replaceAll(GLOB_SPECIAL_CHARACTERS, BACKSLASH_BEFORE_MATCH),
                    MISE_SCRIPT_PATH,
                ),
            ],
        })),
    });
    return {
        session,
        nodeFiles,
        scope,
        level,
        projects: session.repository.files
            .filter((file) => basename(file.path) === TSCONFIG_FILE)
            .map((file) => file.path),
        ruleOptions: options,
        levelRules: buildLevelRules(settings, level === 'all' ? BASE_SELECTORS : []),
        settingsBlocks: buildSettingsBlocks({ session, nodeFiles }),
        allLevelRules,
        blockWriter: {
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
