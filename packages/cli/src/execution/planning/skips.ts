// Why a planned check does not run: an ignore, a waiting setting, a rule, the platform, or a flag.
import ignore from 'ignore';
import { toolName } from '#cli/tools/pins.ts';
import { readText } from '#cli/platform/source.ts';
import type { Session } from '#cli/types/execution/session.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import type { PlannedCheck } from '#cli/types/execution/runtime.ts';
import type { ToolPin, CheckSpec } from '#cli/types/configurations.ts';
import { coversScope, pathMatcher } from '#cli/repository/selectors.ts';
import type { Policy, ScopeSelection } from '#cli/types/policy/settings.ts';
import { OPERATING_SYSTEMS } from '#cli/config/platform/operating-systems.ts';
import type { Host, Skip, PlanOptions, NativeIgnore, SelectionStatus } from '#cli/types/execution/planning.ts';

// Conditions belong to the planned check, so its declaration and scope cannot disagree.
function conditionSkip(check: PlannedCheck, hasGit: boolean): Skip {
    const { configuration, git } = { ...check.manifest?.configuration.when, ...check.spec.when };
    if (configuration !== undefined && !check.scope.view.configurations.includes(configuration))
        return {
            cause: 'condition',
            note: `Needs the ${configuration} configuration, which this scope does not select.`,
        };
    if (git === undefined || git === hasGit) return undefined;
    return {
        cause: 'condition',
        note: git
            ? 'This folder is not a Git repository, so the check has no history to read.'
            : 'The secrets/gitleaks check scans the files of this Git repository.',
    };
}

// The skip an ignore entry without a rule or paths imposes, which disables the whole check.
function ignoreSkip(scope: ScopeSelection, spec: CheckSpec): SelectionStatus | undefined {
    const ignored = scope.view
        .ignoresFor(spec.name)
        .find(
            (entry) =>
                entry.rule === undefined &&
                (entry.paths === undefined || entry.paths.length === 0 || coversScope(entry.paths, scope.scope.path)),
        );
    if (ignored === undefined) return undefined;
    const reason = ignored.reason === undefined ? '' : `: ${ignored.reason}`;
    return { cause: 'ignore', note: `disabled by gspot.toml${reason}` };
}

function waitingSetting(scope: ScopeSelection, spec: CheckSpec): string | undefined {
    const setting = spec.when?.setting;
    if (setting === undefined) return undefined;
    const value = scope.view.settings[setting];
    const isEmpty =
        value === undefined || value === false || value === '' || (Array.isArray(value) && value.length === 0);
    return isEmpty ? setting : undefined;
}

// The skip the platform imposes: the check names other platforms, or its tool has no build for this host.
function platformSkip(spec: CheckSpec, tool: ToolPin | undefined, host: Host): Skip {
    if (spec.platforms && !(spec.platforms as readonly string[]).includes(host.platform))
        return { cause: 'platform', note: `runs on ${spec.platforms.join(', ')} only; this is ${host.platform}` };
    if (tool === undefined) return undefined;
    const missing = missingBuild(tool, host.platform, host.arch);
    if (missing !== undefined) return { cause: 'platform', note: `${tool.name} has no ${missing} build` };
    return undefined;
}

// Native ignore syntax combines authored file content with the tool's saved ordered exclusions.
function nativeIgnore(session: Session, check: PlannedCheck): NativeIgnore | undefined {
    const file = check.spec.ignore_file;
    if (file === undefined) return undefined;
    const text = readText(session.root, file, session.reads);
    const tool = toolName(check.spec);
    const setting = tool === undefined ? undefined : check.scope.view.settings[`tools.${tool}.exclude`];
    const lines = (Array.isArray(setting) ? setting : []).filter((line: unknown) => typeof line === 'string');
    // Saved exclusions remain effective when their generated ignore file has no active tool consumer.
    const matcher = ignore()
        .add(text ?? '')
        .add(lines);
    return { file, matches: matcher.ignores.bind(matcher) };
}

/**
 * The reason persistent policy selects or disables a check.
 * @returns the reason the check is inactive, or undefined when selected
 * @param policy the repository level
 * @param scope the effective policy for the project
 * @param spec the declared check and project prerequisites
 */
export function selectionStatus(policy: Policy, scope: ScopeSelection, spec: CheckSpec): SelectionStatus | undefined {
    if (policy.level !== 'all' && spec.level !== 'recommended')
        return { cause: 'level', note: 'disabled at level recommended' };
    const ignored = ignoreSkip(scope, spec);
    if (ignored !== undefined) return ignored;
    const setting = waitingSetting(scope, spec);
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
 * @returns the skip
 */
export function skipFor(check: PlannedCheck, options: PlanOptions, host: Host, hasGit: boolean, policy: Policy): Skip {
    const selected = selectionStatus(policy, check.scope, check.spec);
    if (selected !== undefined) return selected;
    const condition = conditionSkip(check, hasGit);
    if (condition !== undefined) return condition;
    const byPlatform = options.includeUnsupported === true ? undefined : platformSkip(check.spec, check.tool, host);
    if (byPlatform !== undefined) return byPlatform;
    return options.skips.includes(check.spec.name) ? { cause: 'flag', note: 'skipped by --skip' } : undefined;
}

/**
 * Restrict file checks through policy exclusions and declared native ignore files.
 * @param session the source-read owner
 * @param check the planned check
 * @returns the check with its files restricted
 */
export function restrictIgnoredPaths(session: Session, check: PlannedCheck): PlannedCheck {
    if (check.skip !== undefined || check.spec.runs !== 'files' || check.files.length === 0) return check;
    const ignored = check.scope.view
        .ignoresFor(check.spec.name)
        .flatMap((entry) =>
            entry.rule === undefined && entry.paths !== undefined && entry.paths.length > 0
                ? [pathMatcher(entry.paths)]
                : [],
        );
    const owners = ignored.length === 0 ? [] : [POLICY_FILE];
    const native = nativeIgnore(session, check);
    if (native !== undefined) {
        ignored.push(native.matches);
        owners.push(native.file);
    }
    if (ignored.length === 0) return check;
    const files = check.files.filter((file) => !ignored.some((matches) => matches(file.path)));
    return files.length === 0
        ? { ...check, skip: { cause: 'ignore', note: `all selected paths are disabled by ${owners.join(' or ')}` } }
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
