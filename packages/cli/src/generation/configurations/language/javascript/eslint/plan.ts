import { basename } from 'node:path/posix';
import { escapeGlob } from '#cli/system/paths.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { MISE_TASKS_GLOB } from '#cli/config/files/names.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/projects.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { NODE_SHEBANG_TAG } from '#cli/config/repository/files.ts';
import type { PlannedConfig } from '#cli/types/generation/files.ts';
import type { Config, Configuration } from '#cli/types/manifests.ts';
import { listTaggedExtensions } from '#cli/repository/files/classify.ts';
import type { PlannedEslintFile } from '#cli/types/generation/eslint.ts';
import { buildFilePatterns } from '#cli/generation/configurations/language/javascript/eslint/files.ts';
import { BASE_RULES } from '#cli/config/generation/configurations/language/javascript/eslint/blocks/blocks.ts';
import { buildRuleOptions } from '#cli/generation/configurations/language/javascript/eslint/blocks/settings.ts';
import { buildScopeLimitRules } from '#cli/generation/configurations/language/javascript/eslint/blocks/limits.ts';

import {
    BASE_SELECTORS,
    CODE_LANGUAGES,
} from '#cli/config/generation/configurations/language/javascript/eslint/eslint.ts';

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
    const isRecognized = buildPathMatcher([
        `**/*.{${listTaggedExtensions(...CODE_LANGUAGES)
            .map((extension) => extension.slice(1))
            .join(',')}}`,
    ]);
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
                'no-restricted-syntax': ['error', ...(level === 'all' ? BASE_SELECTORS : [])],
                ...buildScopeLimitRules(settings, repositorySettings.structure.reexports).code,
            },
            javascript: buildScopeLimitRules(settings, repositorySettings.structure.reexports).javascript,
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
