import { listIgnores } from '#cli/settings/scopes.ts';
import { findMissingBuild } from '#cli/manifests/tools.ts';
import type { Tool, Check } from '#cli/types/manifests.ts';
import { NO_HISTORY_MESSAGE } from '#cli/config/planning.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import type { Settings } from '#cli/types/settings/settings.ts';
import type { Repository } from '#cli/types/repository/files.ts';
import { isInScope, isScopeCovered } from '#cli/repository/scopes.ts';
import { listProjectDependencyNames } from '#cli/repository/dependencies.ts';
import type { Host, Skip, PlannedCheck, PlannedScope, SettingsSkip } from '#cli/types/planning.ts';

function findDependencySkip(
    dependencies: string[] | undefined,
    scopePath: string,
    dependencyFiles: Repository['dependencyFiles'],
): Skip | undefined {
    if (dependencies === undefined) return undefined;
    const dependencyNames = listProjectDependencyNames(dependencyFiles, scopePath);
    return dependencies.some((name) => dependencyNames.includes(name))
        ? undefined
        : { cause: 'condition', note: `Needs a project dependency: ${dependencies.join(', ')}.` };
}

function findTagSkip(tags: string[] | undefined, scopePath: string, files: Repository['files']): Skip | undefined {
    if (tags === undefined) return undefined;
    const marked = files.some(
        (file) =>
            file.kind === 'source' && isInScope(file.path, scopePath) && file.tags.some((tag) => tags.includes(tag)),
    );
    return marked ? undefined : { cause: 'condition', note: `Needs files marked ${tags.join(' or ')} in this scope.` };
}

function findConditionSkip(planned: PlannedCheck, repository: Repository): Skip | undefined {
    const { configuration, git, dependencies, tags } = { ...planned.configuration?.when, ...planned.check.when };
    const scope = planned.scope.path;
    if (configuration !== undefined && !planned.scope.settings.configurations.includes(configuration))
        return {
            cause: 'condition',
            note: `Needs the ${configuration} configuration, which this scope does not select.`,
        };
    const skip =
        findDependencySkip(dependencies, scope, repository.dependencyFiles) ??
        findTagSkip(tags, scope, repository.files);
    if (skip !== undefined || git !== true || repository.hasGit) return skip;
    return {
        cause: 'condition',
        note: NO_HISTORY_MESSAGE,
    };
}

function findIgnoreSkip(scope: Scope, check: Check): SettingsSkip | undefined {
    const ignored = listIgnores(scope.settings, check.id).find(
        (ignore) =>
            ignore.rule === undefined && (ignore.paths.length === 0 || isScopeCovered(ignore.paths, scope.path)),
    );
    if (ignored === undefined) return undefined;
    return { cause: 'ignore', note: `turned off by an ignore in gspot.toml: ${ignored.reason}` };
}

function findEmptySetting(scope: Scope, check: Check): string | undefined {
    const setting = check.when?.setting;
    if (setting === undefined) return undefined;
    return isSettingEmpty(scope.settings.valuesByKey[setting]) ? setting : undefined;
}

/**
Check whether a setting holds no value: unset, false, an empty string, or a table of empty lists.

@param value the resolved setting.
*/
export function isSettingEmpty(value: unknown): boolean {
    if (typeof value === 'object' && value !== null) return Object.values(value).flat().length === 0;
    const empty: unknown[] = [undefined, false, ''];
    return empty.includes(value);
}

/**
Skip checks for other systems, or for tools with no build for this system.

@param check the check to read.
@param tool the tool and its pin.
@param host the system and architecture.
@returns undefined when this system can run the check.
*/
export function findSystemSkip(check: Check, tool: Tool | undefined, host: Host): Skip | undefined {
    if (check.operating_systems && !(check.operating_systems as readonly string[]).includes(host.platform))
        return {
            cause: 'system',
            note: `runs on ${check.operating_systems.join(', ')} only; this is ${host.platform}`,
        };
    if (tool === undefined) return undefined;
    const missing = findMissingBuild(tool, host);
    if (missing !== undefined) return { cause: 'system', note: `${tool.name} has no ${missing} build` };
    return undefined;
}

function findConfigSkip(settings: Settings, scope: Scope, check: Check): SettingsSkip | undefined {
    const tool = check.when?.config_file;
    if (tool === undefined) return undefined;
    const selected = scope.configurations.some((configuration) =>
        configuration.configs.some(
            (file) =>
                file.tool.includes(tool) &&
                file.target.endsWith('.yml') &&
                (file.level !== 'all' || settings.level === 'all'),
        ),
    );
    if (selected || !isSettingEmpty(scope.settings.valuesByKey[`tools.${tool}.rule_files`])) return undefined;
    return { cause: 'setting', note: `No selected configuration or tools.${tool}.rule_files supplies local rules.` };
}

/**
Find the reason that the settings turn a check off.

@param settings the validated gspot.toml.
@param scope the settings of the project folder.
@param check the check and its project prerequisites.
@returns undefined for an active check.
*/
export function findSettingsSkip(settings: Settings, scope: Scope, check: Check): SettingsSkip | undefined {
    if (settings.level !== 'all' && check.level !== 'basic') return { cause: 'level', note: 'off at level basic' };
    const ignored = findIgnoreSkip(scope, check);
    if (ignored !== undefined) return ignored;
    const ruleFiles = findConfigSkip(settings, scope, check);
    if (ruleFiles !== undefined) return ruleFiles;
    const setting = findEmptySetting(scope, check);
    return setting === undefined ? undefined : { cause: 'setting', note: `needs the setting ${setting}` };
}

/**
Find the first reason that a planned check cannot run.

@param check the plan to test.
@param planned what planning reads.
@returns undefined when the check can run.
*/
export function findFirstSkip(check: PlannedCheck, planned: PlannedScope): Skip | undefined {
    const { session, host } = planned;
    const settings = session.settings;
    const selected = findSettingsSkip(settings, check.scope, check.check);
    if (selected !== undefined) return selected;
    const condition = findConditionSkip(check, session.repository);
    if (condition !== undefined) return condition;
    return findSystemSkip(check.check, check.tool, host);
}
