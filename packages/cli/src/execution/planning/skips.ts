// Why a planned check does not run: an ignore, a waiting setting, a rule, the platform, or a flag.
import { pathMatcher } from '#cli/repository/selectors.ts';
import { waitingSetting } from '#cli/policy/check-state.ts';
import type { ToolPin, CheckSpec } from '#cli/types/kits.ts';
import { PLATFORM_LABELS } from '#cli/config/execution/planning.ts';
import type { PlannedCheck } from '#cli/types/execution/execution.ts';
import type { Host, Skip, RuleSkip, PlanOptions } from '#cli/types/execution/planning.ts';

// The rules a check declares about where it runs, each with the sentence that says why it was skipped.
const RULE_SKIPS: RuleSkip[] = [
    {
        applies: (spec, check) => spec.needs !== undefined && !check.scope.view.kits.includes(spec.needs),
        note: (spec) => `needs the ${spec.needs ?? ''} configuration, which this scope does not select`,
    },
    {
        applies: (spec, _check, hasGit) => spec.needs_git === true && !hasGit,
        note: () => 'this folder is no git repository, so the check has nothing to read',
    },
    {
        applies: (spec, _check, hasGit) => spec.needs_git === false && hasGit,
        note: () => 'this folder is a git repository, so the git check covers it',
    },
];

// The skip an ignore entry without a rule or paths imposes, which disables the whole check.
function ignoreSkip(check: PlannedCheck): Skip {
    const ignored = check.scope.view
        .ignoresFor(check.spec.name)
        .find((entry) => entry.rule === undefined && (entry.paths === undefined || entry.paths.length === 0));
    if (ignored === undefined) return undefined;
    const reason = ignored.reason === undefined ? '' : `: ${ignored.reason}`;
    return { source: 'ignore', note: `disabled by gspot.toml${reason}` };
}

// The skip the platform imposes: the check names other platforms, or its tool has no build for this host.
function platformSkip(spec: CheckSpec, tool: ToolPin | undefined, host: Host): Skip {
    if (spec.platforms && !(spec.platforms as readonly string[]).includes(host.platform))
        return { source: 'platform', note: `runs on ${spec.platforms.join(', ')} only; this is ${host.platform}` };
    const missing = tool === undefined ? undefined : missingBuild(tool, host.platform, host.arch);
    if (tool !== undefined && missing !== undefined)
        return { source: 'platform', note: `${tool.name} has no ${missing} build` };
    return undefined;
}

/**
 * Why the check does not run, in the order the reasons take precedence, or undefined when it runs.
 * @param check the planned check
 * @param options the run options
 * @param host the platform and architecture the run is on
 * @param hasGit whether the repository is a Git repository
 * @returns the skip
 */
export function skipFor(check: PlannedCheck, options: PlanOptions, host: Host, hasGit: boolean): Skip {
    const ignored = ignoreSkip(check);
    if (ignored !== undefined) return ignored;
    const setting = waitingSetting(check.scope, check.spec);
    if (setting !== undefined) return { source: 'rules', note: `set ${setting} to turn this on` };
    const rule = RULE_SKIPS.find((candidate) => candidate.applies(check.spec, check, hasGit));
    if (rule !== undefined) return { source: 'rules', note: rule.note(check.spec) };
    const byPlatform = platformSkip(check.spec, check.tool, host);
    if (byPlatform !== undefined) return byPlatform;
    return options.skips.includes(check.spec.name) ? { source: 'flag', note: 'skipped by --skip' } : undefined;
}

/**
 * Drops the paths an ignore entry with paths disables, skipping the check when none remain.
 * @param check the planned check
 * @returns the check with its files restricted
 */
export function restrictIgnoredPaths(check: PlannedCheck): PlannedCheck {
    if (check.skip !== undefined || check.spec.runs !== 'files' || check.files.length === 0) return check;
    const ignored = check.scope.view
        .ignoresFor(check.check)
        .flatMap((entry) =>
            entry.rule === undefined && entry.paths !== undefined && entry.paths.length > 0
                ? [pathMatcher(entry.paths)]
                : [],
        );
    if (ignored.length === 0) return check;
    const files = check.files.filter((file) => !ignored.some((matches) => matches(file.path)));
    return files.length === 0
        ? { ...check, skip: { source: 'ignore', note: 'all selected paths are disabled by gspot.toml' } }
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
    const label = PLATFORM_LABELS[platform] ?? platform;
    // A pin that names the operating system with another architecture lacks this architecture only.
    return named.some((entry) => entry.startsWith(`${platform}-`)) ? `${arch} ${label}` : label;
}
