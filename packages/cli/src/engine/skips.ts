import { LOCAL_RULES_SETTING } from '#cli/config/engine.ts';
import { isRepositoryRun } from '#cli/engine/files.ts';
import { LIMIT_READERS } from '#cli/manifests/limits.ts';
import { listProjectDependencyNames } from '#cli/repository/dependencies.ts';
import { isScopeCovered } from '#cli/repository/scopes.ts';
import { listIgnores } from '#cli/settings/scopes.ts';
import { buildFilenameMatcher } from '#cli/system/matchers.ts';
import { isInScope } from '#cli/system/paths.ts';
import { findValueAt } from '#cli/system/tables.ts';
import { formatNameList } from '#cli/system/text.ts';
import { findMissingBuild } from '#cli/tools/pins.ts';
import type { PlannedCheck, PlannedScope, SettingReader, Skip } from '#cli/types/engine/plan.ts';
import type { Check, Tool } from '#cli/types/manifests.ts';
import type { Repository } from '#cli/types/repository.ts';
import type { Scope, Settings } from '#cli/types/settings.ts';
import type { Host } from '#cli/types/tools.ts';

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

function findFilenameSkip(
    filenames: string[] | undefined,
    scopePath: string,
    files: Repository['files'],
): Skip | undefined {
    if (filenames === undefined) return undefined;
    const isNamed = buildFilenameMatcher(filenames);
    const hasNamedFile = files.some(
        (file) => file.kind === 'source' && isInScope(file.path, scopePath) && isNamed(file.path),
    );
    return hasNamedFile
        ? undefined
        : { cause: 'condition', note: `Needs a file named ${formatNameList(filenames, 'disjunction')} in this scope.` };
}

function findConditionSkip(planned: PlannedCheck, repository: Repository): Skip | undefined {
    const { dependencies, filenames, tags } = { ...planned.check.when };
    const scopePath = planned.scope.path;
    return (
        findDependencySkip(dependencies, scopePath, repository.dependencyFiles) ??
        findFilenameSkip(filenames, scopePath, repository.files) ??
        findTagSkip(tags, scopePath, repository.files)
    );
}

function findIgnoreSkip(scope: Scope, check: Check): Skip | undefined {
    const ignored = listIgnores(scope.settings, check.id).find(
        (ignore) =>
            ignore.rule === undefined && (ignore.paths === undefined || isScopeCovered(ignore.paths, scope.path)),
    );
    return ignored === undefined
        ? undefined
        : { cause: 'ignore', note: `turned off by an ignore in gspot.toml: ${ignored.reason}` };
}

function findConfigSkip(settings: Settings, scope: Scope, check: Check): Skip | undefined {
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

function findConfigurationSkip(scope: Scope, check: Check): Skip | undefined {
    const configuration = check.when?.configuration;
    if (configuration === undefined || scope.settings.configurations.includes(configuration)) return undefined;
    return { cause: 'condition', note: `Needs the ${configuration} configuration, which this scope does not select.` };
}

export function isSettingEmpty(value: unknown): boolean {
    if (typeof value === 'object' && value !== null) return Object.values(value).flat().length === 0;
    const empty: unknown[] = [undefined, false, ''];
    return empty.includes(value);
}

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

export function findSettingsSkip(settings: Settings, scope: Scope, check: Check): Skip | undefined {
    if (settings.level !== 'all' && check.level !== 'basic') return { cause: 'level', note: 'off at level basic' };
    const unselected = findConfigurationSkip(scope, check);
    if (unselected !== undefined) return unselected;
    const ignored = findIgnoreSkip(scope, check);
    if (ignored !== undefined) return ignored;
    const ruleFiles = findConfigSkip(settings, scope, check);
    if (ruleFiles !== undefined) return ruleFiles;
    const setting = findEmptySetting(settings, scope, check);
    return setting === undefined ? undefined : { cause: 'setting', note: `needs the setting ${setting}` };
}

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

export function findEmptySetting(settings: Settings, scope: Scope, check: Check): string | undefined {
    const setting = check.when?.setting;
    if (setting === undefined || !isSettingEmpty(scope.settings.valuesByKey[setting])) return undefined;
    const isSetInScope =
        isRepositoryRun(check) &&
        settings.scopes.values().some(({ written }) => !isSettingEmpty(findValueAt(written, setting.split('.'))));
    return isSetInScope ? undefined : setting;
}

/**
Tell whether a setting changes nothing at this level: every check that reads it is off, and at least one exists.
*/
export function isSettingUnread(settings: Settings, scope: Scope, key: string): boolean {
    if (key.startsWith('limits.')) return listSettingReaders(settings, scope, key).every(({ enabled }) => !enabled);
    const owner = scope.configurations.find((configuration) => key.startsWith(`${configuration.name}.`));
    const checks = owner?.checks ?? [];
    return checks.length > 0 && settings.level !== 'all' && checks.every((check) => check.level === 'all');
}

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
