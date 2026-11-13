import { basename, relative } from 'node:path/posix';

import { CODE_LANGUAGES, DEFAULT_PROJECT_FILES } from '#cli/config/configurations/javascript/eslint-blocks.ts';
import { BOUNDARY_FOLDERS_CONSTANT } from '#cli/config/configurations/javascript/eslint-config.ts';
import { BASE_RULES } from '#cli/config/configurations/javascript/eslint-rules.ts';
import { NODE_SHEBANG_TAG } from '#cli/config/configurations/shared.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/projects.ts';
import { listImportBoundaryFolders } from '#cli/configurations/language/javascript/eslint/blocks/imports.ts';
import { buildScopeLimitRules } from '#cli/configurations/language/javascript/eslint/blocks/limits.ts';
import { buildRuntimes } from '#cli/configurations/language/javascript/eslint/blocks/runtimes.ts';
import {
    buildExtensionGlob,
    buildFilePatterns,
    splitGlobs,
} from '#cli/configurations/language/javascript/eslint/files.ts';
import { listScriptFiles } from '#cli/configurations/language/javascript/sources.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { readTsconfigProject } from '#cli/parsers/projects/tsconfig.ts';
import { compareScopeDepth } from '#cli/repository/scopes.ts';
import { joinScopeSelector } from '#cli/settings/values/paths.ts';
import { listSettingsTables } from '#cli/settings/values/written.ts';
import { convertToPosixPath, extractParentFolder } from '#cli/system/paths.ts';
import { buildPathMatcher } from '#cli/system/patterns.ts';
import type {
    EslintRuleOptions,
    PlannedEslintFile,
    ScopeEslintSettings,
} from '#cli/types/configurations/javascript.ts';
import type { PlannedConfig } from '#cli/types/configurations/shared.ts';
import type { Config, Configuration } from '#cli/types/manifests.ts';
import type { Scope, Settings } from '#cli/types/settings.ts';
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

function buildRuleOptions(settings: Settings, scopes: Scope[]): EslintRuleOptions[] {
    const scopesByPath = new Map(scopes.map((scope) => [scope.path, scope]));
    const tables = listSettingsTables(settings).toSorted((first, second) =>
        compareScopeDepth(first.scopePath, second.scopePath),
    );
    const scopeSettings = tables.flatMap<ScopeEslintSettings>(({ scopePath, table }) => {
        const owner = scopesByPath.get(scopePath);
        const options = table.tools?.eslint;
        return owner === undefined || options === undefined ? [] : { scope: owner, settings: options };
    });
    const scopeOptions = scopeSettings.flatMap(({ scope, settings }): EslintRuleOptions[] =>
        settings.rules === undefined
            ? []
            : [
                  {
                      scopePath: scope.path,
                      ...splitGlobs(['**/*']),
                      rules: settings.rules,
                  },
              ],
    );
    const overrides = scopeSettings.flatMap(({ scope, settings }) =>
        (settings.override ?? []).flatMap(({ paths, rules }) =>
            rules === undefined
                ? []
                : {
                      scopePath: scope.path,
                      ...splitGlobs(paths.map((path) => joinScopeSelector(path, scope.path))),
                      rules,
                  },
        ),
    );
    return [...scopeOptions, ...overrides];
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
        languageRules: { code: { ...BASE_RULES, ...limitRules.code }, javascript: limitRules.javascript },
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
