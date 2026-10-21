import type { Settings } from '#cli/types/settings/file.ts';
import type { Tool, Check } from '#cli/types/configurations.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import type { Repository } from '#cli/types/repository/inventory.ts';
import { isInScope, isScopeCovered } from '#cli/repository/scopes.ts';
import { listIgnores, isFileIgnore } from '#cli/settings/scope-view.ts';
import { findMissingBuild } from '#cli/configurations/declared-tools.ts';
import { listProjectDependencyNames } from '#cli/repository/dependency-files.ts';
import type { Skip, Host, PlannedScope, PlannedCheck, SettingsSkip } from '#cli/types/planning.ts';

// A check that needs a dependency skips a scope whose projects declare none of them.
function findDependencySkip(
    dependencies: string[] | undefined,
    scopePath: string,
    dependencyFiles: Repository['dependencyFiles'],
): Skip | undefined {
    if (dependencies === undefined) return undefined;
    const declared = listProjectDependencyNames(dependencyFiles, scopePath);
    return dependencies.some((name) => declared.includes(name))
        ? undefined
        : { cause: 'condition', note: `Needs a project dependency: ${dependencies.join(', ')}.` };
}

// A check that needs marked files skips a scope that holds none, as configuration detection does.
function findTagSkip(tags: string[] | undefined, scopePath: string, files: Repository['files']): Skip | undefined {
    if (tags === undefined) return undefined;
    const marked = files.some(
        (file) =>
            file.kind === 'source' && isInScope(file.path, scopePath) && file.tags.some((tag) => tags.includes(tag)),
    );
    return marked ? undefined : { cause: 'condition', note: `Needs files marked ${tags.join(' or ')} in this scope.` };
}

// Conditions belong to the planned check, so its declaration and scope cannot disagree.
function findConditionSkip(check: PlannedCheck, repository: Repository): Skip | undefined {
    const { configuration, git, dependencies, tags } = { ...check.configuration?.when, ...check.check.when };
    const scope = check.selection.scope.path;
    if (configuration !== undefined && !check.selection.view.configurations.includes(configuration))
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
        note: 'This folder is not a Git repository, so the check has no history to read.',
    };
}

// Find the skip that an ignore record without a rule or paths causes: the whole check turns off.
function findIgnoreSkip(selection: Scope, check: Check): SettingsSkip | undefined {
    const ignored = listIgnores(selection.view, check.name).find(
        (entry) =>
            isFileIgnore(entry) && (entry.paths.length === 0 || isScopeCovered(entry.paths, selection.scope.path)),
    );
    if (ignored === undefined) return undefined;
    return { cause: 'ignore', note: `turned off by an ignore in gspot.toml: ${ignored.reason}` };
}

function findEmptySetting(scope: Scope, check: Check): string | undefined {
    const setting = check.when?.setting;
    if (setting === undefined) return undefined;
    return isSettingEmpty(scope.view.settings[setting]) ? setting : undefined;
}

/**
 * Check for an inactive setting, including a table with empty lists.
 *
 * @param value the resolved setting.
 * @returns whether the setting leaves its consumer inactive.
 */
export function isSettingEmpty(value: unknown): boolean {
    if (typeof value === 'object' && value !== null) return Object.values(value).flat().length === 0;
    const empty: unknown[] = [undefined, false, ''];
    return empty.includes(value);
}

/**
 * Skip checks for other systems, or for tools with no build for this system.
 *
 * @param check the declaration to read.
 * @param tool the declaration and its pin.
 * @param host the system and architecture.
 *
 * @returns the system skip, or undefined when this system can run the check.
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

/**
 * Find the reason that the settings turn a check off.
 *
 * @param settings the validated gspot.toml.
 * @param scope the settings of the project folder.
 * @param check the declaration and project prerequisites.
 * @returns the skip reason, or undefined for an active check.
 */
export function findSettingsSkip(settings: Settings, scope: Scope, check: Check): SettingsSkip | undefined {
    if (settings.level !== 'all' && check.level !== 'recommended')
        return { cause: 'level', note: 'disabled at level recommended' };
    const ignored = findIgnoreSkip(scope, check);
    if (ignored !== undefined) return ignored;
    const setting = findEmptySetting(scope, check);
    return setting === undefined ? undefined : { cause: 'setting', note: `requires project setting ${setting}` };
}

/**
 * Find the first reason that a planned check cannot run.
 *
 * @param check the plan to test.
 * @param planned what planning reads.
 * @param planned.session the repository.
 * @param planned.options the parsed flags.
 * @param planned.host the system name and architecture.
 *
 * @returns the first skip, or undefined when the check can run.
 */
export function findFirstSkip(check: PlannedCheck, planned: PlannedScope): Skip | undefined {
    const { session, options, host } = planned;
    const settings = session.settingsFile.settings;
    const selected = findSettingsSkip(settings, check.selection, check.check);
    if (selected !== undefined) return selected;
    const condition = findConditionSkip(check, session.repository);
    if (condition !== undefined) return condition;
    return options.forConfiguration === true ? undefined : findSystemSkip(check.check, check.tool, host);
}
