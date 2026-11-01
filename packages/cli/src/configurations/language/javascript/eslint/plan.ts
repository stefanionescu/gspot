import { basename } from 'node:path/posix';
import { escapeGlob } from '#cli/system/paths.ts';
import type { Scope } from '#cli/types/settings.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers.ts';
import type { Config } from '#cli/types/repository.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { BASE_RULES } from '#cli/config/configurations/eslint.ts';
import { CODE_LANGUAGES } from '#cli/config/configurations/blocks.ts';
import { MISE_TASKS_GLOB, NODE_SHEBANG_TAG } from '#cli/config/configurations/structure.ts';
import type { PlannedConfig, PlannedEslintFile } from '#cli/types/configurations/language.ts';
import { buildRuleOptions } from '#cli/configurations/language/javascript/eslint/blocks/settings.ts';
import { buildScopeLimitRules } from '#cli/configurations/language/javascript/eslint/blocks/limits.ts';
import { buildFilePatterns, buildExtensionGlob } from '#cli/configurations/language/javascript/eslint/files.ts';

function listConfigConfigurations(scopes: Scope[], scope: Scope, config: Config): Configuration[] {
    if (config.per_scope) return scope.configurations;
    const every = [scope, ...scopes].flatMap((each) => each.configurations);
    return new Map(every.map((configuration) => [configuration.name, configuration])).values().toArray();
}

/**
Collect what the ESLint config file of one scope needs: its file patterns and rule options.

@param planned the config file to build.
*/
export function buildPlannedEslintFile(planned: PlannedConfig): PlannedEslintFile {
    const { session, scope, config } = planned;
    const { settings } = scope;
    const { scopes } = session;
    const repositorySettings = session.settings;
    const { level } = repositorySettings;
    const isRecognized = buildPathMatcher([buildExtensionGlob(...CODE_LANGUAGES)]);
    const nodeFiles = session.repository.files
        .filter((file) => !isRecognized(file.path) && file.kind === 'source' && file.tags.includes(NODE_SHEBANG_TAG))
        .map((file) => file.path);
    const configurations = listConfigConfigurations(scopes, scope, config);
    const eslintFiles = buildFilePatterns({
        components: configurations,
        nodeFiles,
        scopes: scopes.map((each) => ({
            scope: each.path,
            tests: each.settings.test_files,
            scripts: [
                ...(each.settings.tables.javascript?.script_files ?? []),
                joinScope(escapeGlob(each.path), MISE_TASKS_GLOB),
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
        levelRules: {
            code: {
                ...BASE_RULES,
                ...buildScopeLimitRules(settings).code,
            },
            javascript: buildScopeLimitRules(settings).javascript,
        },
        blockWriter: {
            allLevelRules: new Set(
                configurations.flatMap((configuration) => [...configuration.eslint.all_level_rules]),
            ),
            level,
            codeFiles: eslintFiles.code,
            ruleOptions: buildRuleOptions(repositorySettings, scopes),
        },
        eslintFiles,
        configurations,
    };
}
