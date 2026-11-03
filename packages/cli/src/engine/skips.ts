import type { Host } from '#cli/types/tools.ts';
import { isInScope } from '#cli/system/paths.ts';
import { findValueAt } from '#cli/system/tables.ts';
import { formatNameList } from '#cli/system/text.ts';
import { listIgnores } from '#cli/settings/scopes.ts';
import { findMissingBuild } from '#cli/tools/pins.ts';
import { isRepositoryRun } from '#cli/engine/files.ts';
import { LIMIT_READERS } from '#cli/manifests/limits.ts';
import { isScopeCovered } from '#cli/repository/scopes.ts';
import type { Tool, Check } from '#cli/types/manifests.ts';
import type { Repository } from '#cli/types/repository.ts';
import { LOCAL_RULES_SETTING } from '#cli/config/engine.ts';
import type { Scope, Settings } from '#cli/types/settings.ts';
import { listProjectDependencyNames } from '#cli/repository/dependencies.ts';
import type { Skip, PlannedCheck, PlannedScope, SettingsSkip, SettingReader } from '#cli/types/engine/plan.ts';

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
    const isMarked = files.some(
        (file) =>
            file.kind === 'source' && isInScope(file.path, scopePath) && file.tags.some((tag) => tags.includes(tag)),
    );
    return isMarked
        ? undefined
        : { cause: 'condition', note: `Needs files marked ${formatNameList(tags, 'disjunction')} in this scope.` };
}

function findConditionSkip(planned: PlannedCheck, repository: Repository): Skip | undefined {
    const { configuration, dependencies, tags } = { ...planned.check.when };
    const scope = planned.scope.path;
    if (configuration !== undefined && !planned.scope.settings.configurations.includes(configuration))
        return {
            cause: 'condition',
            note: `Needs the ${configuration} configuration, which this scope does not select.`,
        };
    return (
        findDependencySkip(dependencies, scope, repository.dependencyFiles) ??
        findTagSkip(tags, scope, repository.files)
    );
}

function findIgnoreSkip(scope: Scope, check: Check): SettingsSkip | undefined {
    const ignored = listIgnores(scope.settings, check.id).find(
        (ignore) =>
            ignore.rule === undefined && (ignore.paths === undefined || isScopeCovered(ignore.paths, scope.path)),
    );
    return ignored === undefined
        ? undefined
        : { cause: 'ignore', note: `turned off by an ignore in gspot.toml: ${ignored.reason}` };
}

function findEmptySetting(settings: Settings, scope: Scope, check: Check): string | undefined {
    const setting = check.when?.setting;
    if (setting === undefined || !isSettingEmpty(scope.settings.valuesByKey[setting])) return undefined;
    const isSetInScope =
        isRepositoryRun(check) &&
        settings.scopes.values().some(({ written }) => !isSettingEmpty(findValueAt(written, setting.split('.'))));
    return isSetInScope ? undefined : setting;
}

function findConfigSkip(settings: Settings, scope: Scope, check: Check): SettingsSkip | undefined {
    const tool = check.when?.config_file;
    if (tool === undefined) return undefined;
    const isSelected = scope.configurations.some((configuration) =>
        configuration.configs.some(
            (file) =>
                file.tool.includes(tool) &&
                file.target.endsWith('.yml') &&
                (file.level !== 'all' || settings.level === 'all'),
        ),
    );
    return isSelected || !isSettingEmpty(scope.settings.valuesByKey[LOCAL_RULES_SETTING])
        ? undefined
        : { cause: 'setting', note: `No selected configuration or ${LOCAL_RULES_SETTING} supplies local rules.` };
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
    return missing === undefined ? undefined : { cause: 'system', note: `${tool.name} has no ${missing} build` };
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
    const setting = findEmptySetting(settings, scope, check);
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
    const selectedCheck =
        planned.options.only?.includes(check.check.id) === true
            ? { ...check.check, level: 'basic' as const }
            : check.check;
    return (
        findSettingsSkip(settings, check.scope, selectedCheck) ??
        findConditionSkip(check, session.repository) ??
        findSystemSkip(check.check, check.tool, host)
    );
}

/**
List the selected checks that read a limit and whether its rules run at this level.

@param settings the repository level and ignores.
@param scope the selected configurations and settings of one folder.
@param key the setting whose consumers to find.
*/
export function listSettingReaders(settings: Settings, scope: Scope, key: string): SettingReader[] {
    if (!key.startsWith('limits.')) return [];
    const names = key.slice('limits.'.length).split('.');
    const limit = names.at(-1) as string;
    const language = names.length === 1 ? undefined : names[0];
    const checks = scope.configurations.flatMap((configuration) => configuration.checks);
    return LIMIT_READERS.filter(
        (reader) => reader.limits.includes(limit) && (language === undefined || reader.languages.includes(language)),
    ).flatMap((reader) => {
        const check = checks.find((check) => check.id === reader.check);
        if (check === undefined) return [];
        const skip = findSettingsSkip(settings, scope, check);
        const note = settings.level === 'all' ? skip?.note : `off at level ${settings.level}`;
        return [{ check: check.id, enabled: note === undefined, ...(note !== undefined && { note }) }];
    });
}
