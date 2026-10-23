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

function listConfigFileConfigurations(scopes: Scope[], scope: Scope, configFile: ConfigFile): Configuration[] {
    if (configFile.per_scope) return scope.configurations;
    const every = [scope, ...scopes].flatMap((each) => each.configurations);
    return new Map(every.map((configuration) => [configuration.name, configuration])).values().toArray();
}

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

function buildSettingsBlocks(planned: Pick<PlannedEslintFile, 'session' | 'nodeFiles'>): EslintRuleBlock[] {
    const { session } = planned;
    const ignored = session.settingsFile.settings.ignore.flatMap((ignore): EslintRuleBlock[] =>
        ignore.rule === undefined || ignore.check !== ESLINT_CHECK
            ? []
            : [
                  {
                      scope: '',
                      ...splitGlobs(ignore.paths === undefined || ignore.paths.length === 0 ? ['**/*'] : ignore.paths),
                      rules: { [ignore.rule]: 'off' },
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
        scopes: scopes.map((each) => ({
            scope: each.folder.path,
            tests: each.settings.test_files,
            scripts: [
                ...(each.settings.values.javascript?.script_files ?? []),
                joinScope(
                    each.folder.path.replaceAll(GLOB_SPECIAL_CHARACTERS, BACKSLASH_BEFORE_MATCH),
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
