import { readFileSync } from 'node:fs';
import { basename } from 'node:path/posix';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { MISE_SCRIPT_PATH } from '#cli/config/files/names.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { listAssets, buildAssetPath } from '#cli/system/assets.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/projects/tsconfig.ts';
import { CONFIGURATIONS_FOLDER } from '#cli/config/configurations/names.ts';
import { NODE_SHEBANG_TAG } from '#cli/config/repository/files/classify.ts';
import type { ConfigFile, Configuration } from '#cli/types/configurations.ts';
import { eslintPresetsSchema } from '#cli/schemas/configurations/eslint-presets.ts';
import { type EslintPresets, type PlannedEslintFile } from '#cli/types/generation/eslint.ts';
import { buildLevelRules } from '#cli/generation/configurations/language/javascript/eslint/blocks/base.ts';
import { buildRuleOptions } from '#cli/generation/configurations/language/javascript/eslint/blocks/settings.ts';
import { ESLINT_PRESETS_FILE } from '#cli/config/generation/configurations/language/javascript/eslint/presets.ts';

import {
    BASE_SELECTORS,
    CODE_LANGUAGES,
} from '#cli/config/generation/configurations/language/javascript/eslint/config-file.ts';
import {
    buildScopeGlob,
    buildFilePatterns,
    buildSourcePattern,
} from '#cli/generation/configurations/language/javascript/eslint/files.ts';

const PRESET_ASSET_PATHS = new Set(listAssets(CONFIGURATIONS_FOLDER));

function listConfigFileConfigurations(scopes: Scope[], scope: Scope, configFile: ConfigFile): Configuration[] {
    if (configFile.per_scope) return scope.configurations;
    const every = [scope, ...scopes].flatMap((each) => each.configurations);
    return new Map(every.map((configuration) => [configuration.name, configuration])).values().toArray();
}

function readEslintPresets(session: PlannedConfigFile['session']): Map<string, EslintPresets> {
    return new Map(
        session.configurations
            .values()
            .filter((configuration) => PRESET_ASSET_PATHS.has(`${configuration.folder}/${ESLINT_PRESETS_FILE}`))
            .map((configuration): [string, EslintPresets] => [
                configuration.name,
                eslintPresetsSchema.parse(
                    JSON.parse(readFileSync(buildAssetPath(`${configuration.folder}/${ESLINT_PRESETS_FILE}`), 'utf8')),
                ),
            ]),
    );
}

/**
Collect what the ESLint config file of one scope needs: its file patterns, presets, and rule options.

@param planned the config file to build.
@returns the scopes, presets, and rule options of the ESLint file.
*/
export function buildPlannedEslintFile(planned: PlannedConfigFile): PlannedEslintFile {
    const { session, scope, configFile } = planned;
    const { settings } = scope;
    const { scopes } = session;
    const repositorySettings = session.settings;
    const { level } = repositorySettings;
    const isRecognized = buildPathMatcher([buildSourcePattern(...CODE_LANGUAGES)]);
    const nodeFiles = session.repository.files
        .filter((file) => !isRecognized(file.path) && file.kind === 'source' && file.tags.includes(NODE_SHEBANG_TAG))
        .map((file) => file.path);
    const configurations = listConfigFileConfigurations(scopes, scope, configFile);
    const eslintFiles = buildFilePatterns({
        components: configurations,
        nodeFiles,
        scopes: scopes.map((each) => ({
            scope: each.path,
            tests: each.settings.test_files,
            scripts: [
                ...(each.settings.tables.javascript?.script_files ?? []),
                buildScopeGlob(each.path, MISE_SCRIPT_PATH),
            ],
        })),
    });
    return {
        session,
        nodeFiles,
        scope,
        projects: session.repository.files
            .filter((file) => basename(file.path) === TSCONFIG_FILE)
            .map((file) => file.path),
        levelRules: buildLevelRules(settings, level === 'all' ? BASE_SELECTORS : []),
        blockWriter: {
            applied: new Set(),
            allLevelRules: new Set(
                session.configurations.values().flatMap((configuration) => configuration.eslint.all_level_rules),
            ),
            level,
            codeFiles: eslintFiles.code,
            ruleOptions: buildRuleOptions(repositorySettings, scopes),
        },
        eslintFiles,
        eslintPresets: readEslintPresets(session),
        configurations,
    };
}
