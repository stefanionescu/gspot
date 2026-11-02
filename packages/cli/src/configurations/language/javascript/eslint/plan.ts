import type { Session } from '#cli/types/tools.ts';
import type { Scope } from '#cli/types/settings.ts';
import { basename, relative } from 'node:path/posix';
import { joinScope } from '#cli/repository/scopes.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers.ts';
import type { Config } from '#cli/types/repository.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { BASE_RULES } from '#cli/config/configurations/eslint.ts';
import { readTsconfigProject } from '#cli/parsers/projects/tsconfig.ts';
import { buildRuntimes } from '#cli/configurations/language/javascript/eslint/runtimes.ts';
import { escapeGlob, convertToPosixPath, extractParentFolder } from '#cli/system/paths.ts';
import { MISE_TASKS_GLOB, NODE_SHEBANG_TAG } from '#cli/config/configurations/structure.ts';
import { CODE_LANGUAGES, DEFAULT_PROJECT_FILES } from '#cli/config/configurations/blocks.ts';
import type { PlannedConfig, PlannedEslintFile } from '#cli/types/configurations/language.ts';
import { buildRuleOptions } from '#cli/configurations/language/javascript/eslint/blocks/settings.ts';
import { buildScopeLimitRules } from '#cli/configurations/language/javascript/eslint/blocks/limits.ts';
import { buildFilePatterns, buildExtensionGlob } from '#cli/configurations/language/javascript/eslint/files.ts';

function listConfigConfigurations(scopes: Scope[], scope: Scope, config: Config): Configuration[] {
    if (config.per_scope) return scope.configurations;
    const every = [scope, ...scopes].flatMap((each) => each.configurations);
    return new Map(every.map((configuration) => [configuration.name, configuration])).values().toArray();
}

function listDefaultProjectFiles(session: Session, projects: string[]): string[] {
    const isDefaultProjectFile = buildPathMatcher([...DEFAULT_PROJECT_FILES]);
    const covered = new Set(
        projects.flatMap((path) => {
            const project = readTsconfigProject(session.root, extractParentFolder(path), [], session.cache);
            return [...(project?.projects.values() ?? [])].flatMap(({ fileNames }) =>
                fileNames.map((file) => relative(convertToPosixPath(session.root), file)),
            );
        }),
    );
    return session.repository.files
        .map(({ path }) => path)
        .filter((path) => isDefaultProjectFile(path) && !covered.has(path));
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
    const projects = session.repository.files
        .filter((file) => basename(file.path) === TSCONFIG_FILE)
        .map((file) => file.path);
    return {
        session,
        nodeFiles,
        scope,
        projects,
        defaultProjectFiles: listDefaultProjectFiles(session, projects),
        levelRules: {
            code: {
                ...BASE_RULES,
                ...buildScopeLimitRules(settings).code,
            },
            javascript: buildScopeLimitRules(settings).javascript,
        },
        blockWriter: {
            runtimes: buildRuntimes(scopes, session.repository.dependencyFiles),
            rulePrefixes: new Map(
                readConfigurations()
                    .values()
                    .flatMap(({ tools }) => tools)
                    .map((tool) => [tool.installers['npm']?.name ?? tool.name, tool.rule_prefix]),
            ),
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
