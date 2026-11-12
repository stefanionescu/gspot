import { basename, relative } from 'node:path/posix';

import { CODE_LANGUAGES, DEFAULT_PROJECT_FILES } from '#cli/config/configurations/eslint/blocks.ts';
import { BASE_RULES } from '#cli/config/configurations/eslint/rules.ts';
import { BOUNDARY_FOLDERS_CONSTANT } from '#cli/config/configurations/javascript.ts';
import { NODE_SHEBANG_TAG } from '#cli/config/configurations/structure.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/projects.ts';
import { listImportBoundaryFolders } from '#cli/configurations/language/javascript/eslint/blocks/imports.ts';
import { buildScopeLimitRules } from '#cli/configurations/language/javascript/eslint/blocks/limits.ts';
import { buildRuleOptions } from '#cli/configurations/language/javascript/eslint/blocks/settings.ts';
import {
    buildExtensionGlob,
    buildFilePatterns,
    listScriptFiles,
} from '#cli/configurations/language/javascript/eslint/files.ts';
import { buildRuntimes } from '#cli/configurations/language/javascript/eslint/runtimes.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { readTsconfigProject } from '#cli/parsers/projects/tsconfig.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { convertToPosixPath, extractParentFolder } from '#cli/system/paths.ts';
import type { PlannedEslintFile } from '#cli/types/configurations/javascript.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';
import type { Config, Configuration } from '#cli/types/manifests.ts';
import type { Scope } from '#cli/types/settings.ts';
import type { Session } from '#cli/types/tools.ts';

function listContributingConfigurations(scopes: Scope[], scope: Scope, config: Config): Configuration[] {
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
    const configurations = listContributingConfigurations(scopes, scope, config);
    const eslintFiles = buildFilePatterns({
        components: configurations,
        nodeFiles,
        scopes: scopes.map((each) => ({
            scopePath: each.path,
            tests: each.settings.test_files,
            scripts: listScriptFiles(each),
        })),
    });
    const limitRules = buildScopeLimitRules(settings);
    const projects = session.repository.files
        .filter((file) => basename(file.path) === TSCONFIG_FILE)
        .map((file) => file.path);
    return {
        session,
        nodeFiles,
        scope,
        projects,
        defaultProjectFiles: listDefaultProjectFiles(session, projects),
        levelRules: { code: { ...BASE_RULES, ...limitRules.code }, javascript: limitRules.javascript },
        blockWriter: {
            runtimes: buildRuntimes(scopes, session.repository.dependencyFiles),
            rulePrefixes: new Map(
                readConfigurations()
                    .values()
                    .flatMap(({ tools }) => tools)
                    .map((tool) => [tool.installers['npm']?.name ?? tool.name, tool.rule_prefix]),
            ),
            sharedLists: new Map([[JSON.stringify(listImportBoundaryFolders(scopes)), BOUNDARY_FOLDERS_CONSTANT]]),
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
