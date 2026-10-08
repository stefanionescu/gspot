// Why a planned check does not run: an ignore, a waiting setting, a rule, the platform, or a flag.
import ignore from 'ignore';
import { readText } from '#cli/platform/source.ts';
import { coversScope } from '#cli/repository/selectors.ts';
import type { PackageManifest } from '#cli/types/parsers/packages.ts';
import { semgrepRuleFiles } from '#cli/configurations/declarations.ts';
import type { Policy, ScopeSelection } from '#cli/types/policy/settings.ts';
import type { ToolPin, CheckDeclaration } from '#cli/types/configurations.ts';
import { OPERATING_SYSTEMS } from '#cli/config/platform/operating-systems.ts';
import { getProjectDependencies } from '#cli/repository/package-manifests.ts';

import type {
    Host,
    Skip,
    Session,
    PlanOptions,
    NativeIgnore,
    PlannedCheck,
    SelectionStatus,
} from '#cli/types/planning.ts';

// Conditions belong to the planned check, so its declaration and scope cannot disagree.
function conditionSkip(check: PlannedCheck, hasGit: boolean, projects: PackageManifest[]): Skip {
    const { configuration, git, dependencies } = { ...check.manifest?.configuration.when, ...check.check.when };
    if (configuration !== undefined && !check.scope.view.configurations.includes(configuration))
        return {
            cause: 'condition',
            note: `Needs the ${configuration} configuration, which this scope does not select.`,
        };
    if (
        dependencies !== undefined &&
        !dependencies.some((name) => name in getProjectDependencies(projects, check.scope.scope.path))
    )
        return { cause: 'condition', note: `Needs a project dependency: ${dependencies.join(', ')}.` };
    if (git !== !hasGit) return undefined;
    return {
        cause: 'condition',
        note: git
            ? 'This folder is not a Git repository, so the check has no history to read.'
            : `The ${check.check.name} check scans the files of this Git repository.`,
    };
}

// The skip an ignore entry without a rule or paths imposes, which disables the whole check.
function ignoreSkip(scope: ScopeSelection, check: CheckDeclaration): SelectionStatus | undefined {
    const ignored = scope.view
        .ignoresFor(check.name)
        .find(
            (entry) =>
                entry.rule === undefined && (entry.paths.length === 0 || coversScope(entry.paths, scope.scope.path)),
        );
    if (ignored === undefined) return undefined;
    const reason = ignored.reason === undefined ? '' : `: ${ignored.reason}`;
    return { cause: 'ignore', note: `disabled by gspot.toml${reason}` };
}

function waitingSetting(scope: ScopeSelection, check: CheckDeclaration): string | undefined {
    const setting = check.when?.setting;
    if (setting === undefined) return undefined;
    const value = scope.view.settings[setting];
    const isEmpty =
        value === undefined || value === false || value === '' || (Array.isArray(value) && value.length === 0);
    return isEmpty ? setting : undefined;
}

// The skip the platform imposes: the check IDs other platforms, or its tool has no build for this host.
function platformSkip(check: CheckDeclaration, tool: ToolPin | undefined, host: Host): Skip {
    if (check.platforms && !(check.platforms as readonly string[]).includes(host.platform))
        return { cause: 'platform', note: `runs on ${check.platforms.join(', ')} only; this is ${host.platform}` };
    if (tool === undefined) return undefined;
    const missing = missingBuild(tool, host.platform, host.arch);
    if (missing !== undefined) return { cause: 'platform', note: `${tool.name} has no ${missing} build` };
    return undefined;
}

// Native ignore syntax belongs to the check's authored or generated ignore file.
function nativeIgnore(session: Session, check: PlannedCheck): NativeIgnore | undefined {
    const file = check.check.ignore_file;
    if (file === undefined) return undefined;
    const matcher = ignore().add(readText(session.root, file, session.reads) ?? '');
    return { file, matches: matcher.ignores.bind(matcher) };
}

/**
 * The reason persistent policy selects or disables a check.
 * @returns the reason the check is inactive, or undefined when selected
 * @param policy the repository level
 * @param scope the effective policy for the project
 * @param check the declared check and project prerequisites
 */
export function selectionStatus(
    policy: Policy,
    scope: ScopeSelection,
    check: CheckDeclaration,
): SelectionStatus | undefined {
    if (policy.level !== 'all' && check.level !== 'recommended')
        return { cause: 'level', note: 'disabled at level recommended' };
    const ignored = ignoreSkip(scope, check);
    if (ignored !== undefined) return ignored;
    if (
        check.name === 'security/semgrep' &&
        semgrepRuleFiles(scope.selected, scope.scope.path, scope.view.options('tools.semgrep').rule_files).length === 0
    )
        return {
            cause: 'condition',
            note: 'No selected configuration or tools.semgrep.rule_files supplies local rules.',
        };
    const setting = waitingSetting(scope, check);
    return setting === undefined
        ? undefined
        : { cause: 'setting', note: `requires project setting ${setting}`, setting };
}

/**
 * Why the check does not run, in the order the reasons take precedence, or undefined when it runs.
 * @param check the planned check
 * @param options the run options
 * @param host the platform and architecture the run is on
 * @param hasGit whether the repository is a Git repository
 * @param policy the repository level
 * @param projects the validated project manifests
 * @returns the skip
 */
export function skipFor(
    check: PlannedCheck,
    options: PlanOptions,
    host: Host,
    hasGit: boolean,
    policy: Policy,
    projects: PackageManifest[],
): Skip {
    const selected = selectionStatus(policy, check.scope, check.check);
    if (selected !== undefined) return selected;
    const condition = conditionSkip(check, hasGit, projects);
    if (condition !== undefined) return condition;
    const byPlatform = options.includeUnsupported === true ? undefined : platformSkip(check.check, check.tool, host);
    if (byPlatform !== undefined) return byPlatform;
    return options.skips.includes(check.check.name) ? { cause: 'flag', note: 'skipped by --skip' } : undefined;
}

/**
 * Restrict file checks through their declared native ignore files.
 * @param session the source-read owner
 * @param check the planned check
 * @returns the check with its files restricted
 */
export function restrictIgnoredPaths(session: Session, check: PlannedCheck): PlannedCheck {
    if (check.skip !== undefined || check.check.runs !== 'files' || check.files.length === 0) return check;
    const native = nativeIgnore(session, check);
    if (native === undefined) return check;
    const files = check.files.filter((file) => !native.matches(file.path));
    return files.length === 0
        ? { ...check, skip: { cause: 'ignore', note: `all selected paths are disabled by ${native.file}` } }
        : { ...check, files };
}

/**
 * The build a tool lacks on a host, such as Windows or arm64 Linux, or undefined when the tool ships for it.
 * @param tool the tool pin
 * @param platform the host platform name: macos, linux, or windows
 * @param arch the host architecture: x64 or arm64
 * @returns the words for the missing build, or undefined
 */
export function missingBuild(tool: ToolPin, platform: string, arch: string): string | undefined {
    const named: readonly string[] = tool.platforms ?? [];
    if (tool.platforms === undefined || named.includes(platform) || named.includes(`${platform}-${arch}`))
        return undefined;
    const label = OPERATING_SYSTEMS.find((system) => system.name === platform)?.label ?? platform;
    // A pin that names the operating system with another architecture lacks this architecture only.
    return named.some((entry) => entry.startsWith(`${platform}-`)) ? `${arch} ${label}` : label;
}
