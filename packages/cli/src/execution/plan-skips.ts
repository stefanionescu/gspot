// Why a planned check does not run: an ignore, a waiting setting, a rule, the platform, or a flag.
import { pathMatcher } from '#cli/repository/paths.ts';
import { waitingSetting } from '#cli/policy/check-state.ts';
import type { CheckSpec } from '#cli/configurations/schema.ts';
import type { ToolPin } from '#cli/configurations/manifests.ts';
import type { PlannedCheck, PlanOptions } from '#cli/execution/plan.ts';

type Skip = PlannedCheck['skip'];
type RuleSkip = {
    applies: (spec: CheckSpec, check: PlannedCheck, hasGit: boolean) => boolean;
    note: (spec: CheckSpec) => string;
};

// The rules a check declares about where it runs, each with the sentence that says why it was skipped.
const RULE_SKIPS: RuleSkip[] = [
    {
        applies: (spec) => spec.reported_by !== undefined,
        note: (spec) => `its findings come from ${spec.reported_by ?? ''}`,
    },
    {
        applies: (spec, check) => spec.needs !== undefined && !check.scope.view.configurations.includes(spec.needs),
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

// The skip a setting the check waits for imposes.
function waitingSkip(check: PlannedCheck): Skip {
    const setting = waitingSetting(check.scope, check.spec);
    return setting === undefined ? undefined : { source: 'rules', note: `set ${setting} to turn this on` };
}

// The first declared rule that keeps the check from running here.
function ruleSkip(check: PlannedCheck, hasGit: boolean): Skip {
    const rule = RULE_SKIPS.find((candidate) => candidate.applies(check.spec, check, hasGit));
    return rule === undefined ? undefined : { source: 'rules', note: rule.note(check.spec) };
}

// The skip the platform imposes: the check names other platforms, or its tool has no Windows build.
function platformSkip(spec: CheckSpec, tool: ToolPin | undefined, platform: string): Skip {
    if (spec.platform && !(spec.platform as readonly string[]).includes(platform))
        return { source: 'platform', note: `runs on ${spec.platform.join(', ')} only; this is ${platform}` };
    if (platform === 'windows' && tool && !tool.windows)
        return { source: 'platform', note: `${tool.name} has no Windows build` };
    return undefined;
}

/**
 * Why the check does not run, in the order the reasons take precedence, or undefined when it runs.
 * @param check the planned check
 * @param options the run options
 * @param platform the platform name
 * @param hasGit whether the repository is a Git repository
 * @returns the skip
 */
export function skipFor(check: PlannedCheck, options: PlanOptions, platform: string, hasGit: boolean): Skip {
    const declared = ignoreSkip(check) ?? waitingSkip(check) ?? ruleSkip(check, hasGit);
    if (declared !== undefined) return declared;
    const byPlatform = platformSkip(check.spec, check.tool, platform);
    if (byPlatform !== undefined) return byPlatform;
    return options.skips.includes(check.spec.name) ? { source: 'flag', note: 'skipped by --skip' } : undefined;
}

/**
 * Drops the paths an ignore entry with paths disables, skipping the check when none remain.
 * @param check the planned check
 * @returns the check with its files restricted
 */
export function restrictIgnoredPaths(check: PlannedCheck): PlannedCheck {
    if (check.skip !== undefined || check.spec.runs !== 'per-file-list' || check.files.length === 0) return check;
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
