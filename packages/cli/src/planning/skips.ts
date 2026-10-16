import ignore from 'ignore';
import { readText } from '#cli/system/file-reads.ts';
import { TOOL_IGNORE_ARGUMENT } from '#cli/config/planning.ts';
import { missingBuild } from '#cli/configurations/tool-pins.ts';
import { coversScope, projectDependencies } from '#cli/repository/scopes.ts';
import type { DependencyFile } from '#cli/types/parsers/dependency-files.ts';
import type { Settings, ScopeSelection } from '#cli/types/settings/values.ts';
import type { ToolDeclaration, CheckDeclaration } from '#cli/types/configurations.ts';
import type { Skip, System, Session, ToolIgnore, PlanInputs, PlannedCheck, SettingsSkip } from '#cli/types/planning.ts';

// Conditions belong to the planned check, so its declaration and scope cannot disagree.
function conditionSkip(check: PlannedCheck, hasGit: boolean, projects: DependencyFile[]): Skip {
    const { configuration, git, dependencies } = { ...check.manifest?.configuration.when, ...check.check.when };
    if (configuration !== undefined && !check.scope.view.configurations.includes(configuration))
        return {
            cause: 'condition',
            note: `Needs the ${configuration} configuration, which this scope does not select.`,
        };
    if (
        dependencies !== undefined &&
        !dependencies.some((name) => name in projectDependencies(projects, check.scope.scope.path))
    )
        return { cause: 'condition', note: `Needs a project dependency: ${dependencies.join(', ')}.` };
    if (git !== true || hasGit) return undefined;
    return {
        cause: 'condition',
        note: 'This folder is not a Git repository, so the check has no history to read.',
    };
}

// The skip an ignore entry without a rule or paths imposes, which disables the whole check.
function ignoreSkip(scope: ScopeSelection, check: CheckDeclaration): SettingsSkip | undefined {
    const ignored = scope.view
        .ignoresFor(check.name)
        .find(
            (entry) =>
                entry.rule === undefined && (entry.paths.length === 0 || coversScope(entry.paths, scope.scope.path)),
        );
    if (ignored === undefined) return undefined;
    const reason = `: ${ignored.reason}`;
    return { cause: 'ignore', note: `disabled by gspot.toml${reason}` };
}

function waitingSetting(scope: ScopeSelection, check: CheckDeclaration): string | undefined {
    const setting = check.when?.setting;
    if (setting === undefined) return undefined;
    return isSettingEmpty(scope.view.settings[setting]) ? setting : undefined;
}

// Native ignore syntax belongs to the check's authored or generated ignore file.
function toolIgnore(session: Session, check: PlannedCheck): ToolIgnore | undefined {
    const argument = check.check.command?.indexOf(TOOL_IGNORE_ARGUMENT) ?? -1;
    const file = argument < 0 ? undefined : check.check.command?.[argument + 1];
    if (file === undefined) return undefined;
    const matcher = ignore().add(readText(session.root, file, session.reads) ?? '');
    return { file, matches: matcher.ignores.bind(matcher) };
}

/**
 * Check for an inactive setting, including a table with empty lists.
 * @param value the resolved setting.
 * @returns whether the setting leaves its consumer inactive.
 */
export function isSettingEmpty(value: unknown): boolean {
    if (typeof value === 'object' && value !== null) return Object.values(value).flat().length === 0;
    const empty: unknown[] = [undefined, false, ''];
    return empty.includes(value);
}

/**
 * Skip checks for other operating systems or tools with no build for this host.
 *
 * @param check the declared check.
 * @param tool the declared tool and its installation pin.
 * @param host the operating system and architecture.
 *
 * @returns the platform skip, or undefined when this host can run the check.
 */
export function systemSkip(check: CheckDeclaration, tool: ToolDeclaration | undefined, host: System): Skip {
    if (check.operating_systems && !(check.operating_systems as readonly string[]).includes(host.platform))
        return {
            cause: 'platform',
            note: `runs on ${check.operating_systems.join(', ')} only; this is ${host.platform}`,
        };
    if (tool === undefined) return undefined;
    const missing = missingBuild(tool, host.platform, host.arch);
    if (missing !== undefined) return { cause: 'platform', note: `${tool.name} has no ${missing} build` };
    return undefined;
}

/**
 * The reason persistent settings selects or disables a check.
 * @returns the check skip reason, or undefined for an active check.
 * @param settings the validated repository settings.
 * @param scope the effective settings for the project.
 * @param check the declared check and project prerequisites.
 */
export function settingsSkip(
    settings: Settings,
    scope: ScopeSelection,
    check: CheckDeclaration,
): SettingsSkip | undefined {
    if (settings.level !== 'all' && check.level !== 'recommended')
        return { cause: 'level', note: 'disabled at level recommended' };
    const ignored = ignoreSkip(scope, check);
    if (ignored !== undefined) return ignored;
    const setting = waitingSetting(scope, check);
    return setting === undefined
        ? undefined
        : { cause: 'setting', note: `requires project setting ${setting}`, setting };
}

/**
 * Select the first applicable reason a planned check cannot run.
 *
 * @param check the planned check.
 * @param root0 the planning inputs.
 * @param root0.session the repository session.
 * @param root0.options the command options.
 * @param root0.platform the operating system name.
 * @param root0.projects the parsed dependency files.
 *
 * @returns the first skip, or undefined when the check can run.
 */
export function skipFor(check: PlannedCheck, { session, options, platform, projects }: PlanInputs): Skip {
    const settings = session.settingsFile.settings;
    const hasGit = session.repository.hasGit;
    const host = { platform, arch: process.arch };
    const selected = settingsSkip(settings, check.scope, check.check);
    if (selected !== undefined) return selected;
    const condition = conditionSkip(check, hasGit, projects);
    if (condition !== undefined) return condition;
    return options.includeUnsupported === true ? undefined : systemSkip(check.check, check.tool, host);
}

/**
 * Restrict file checks through their declared ignore files.
 *
 * @param session the source-read owner.
 * @param check the planned check.
 *
 * @returns the check with its files restricted.
 */
export function restrictIgnoredPaths(session: Session, check: PlannedCheck): PlannedCheck {
    if (check.skip !== undefined || check.check.runs !== 'files' || check.files.length === 0) return check;
    const native = toolIgnore(session, check);
    if (native === undefined) return check;
    const files = check.files.filter((file) => !native.matches(file.path));
    return files.length === 0
        ? { ...check, skip: { cause: 'ignore', note: `all selected paths are disabled by ${native.file}` } }
        : { ...check, files };
}
