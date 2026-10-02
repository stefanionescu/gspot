import type { CheckSpec } from '#cli/types/kits.ts';
import type { Policy, ScopeSelection, RepositoryCheck } from '#cli/types/policy/policy.ts';

/**
 * Describe the persistent policy selection independently of files or tool availability.
 * @param policy the repository policy
 * @param scope the resolved scope the check runs in
 * @param spec the check
 * @returns on, off with its reason, or the setting the check waits for
 */
export function checkState(policy: Policy, scope: ScopeSelection, spec: CheckSpec): string {
    if (policy.level !== 'all' && spec.level !== 'recommended' && !policy.extraChecks.includes(spec.name))
        return 'off (level)';
    if (
        scope.view
            .ignoresFor(spec.name)
            .some((entry) => entry.rule === undefined && (entry.paths === undefined || entry.paths.length === 0))
    )
        return 'off (ignore)';
    const setting = waitingSetting(scope, spec);
    return setting === undefined ? 'on' : `waits for ${setting}`;
}

/**
 * The unmet setting declared by a check, if any.
 * @param scope the resolved scope the check runs in
 * @param spec the check
 * @returns the setting the check waits for, or undefined when it can run
 */
export function waitingSetting(scope: ScopeSelection, spec: CheckSpec): string | undefined {
    const setting = spec.waits_for;
    if (setting === undefined) return undefined;
    const value = scope.view.settings[setting];
    const isEmpty =
        value === undefined || value === false || value === '' || (Array.isArray(value) && value.length === 0);
    return isEmpty ? setting : undefined;
}

/**
 * Normalize a repository command into the check definition used by planning and explanations.
 * @param entry the check the policy declares
 * @returns the check in manifest form
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Planning and explain turn a [[check]] entry into a check definition the same way.
export function repositoryCheckSpec(entry: RepositoryCheck): CheckSpec {
    const { paths, ...definition } = entry;
    return {
        ...definition,
        level: 'recommended',
        runs: 'files',
        summary: entry.summary ?? `Runs the repository's own check ${entry.name}.`,
        why: 'The repository declared this command in gspot.toml as part of its gate.',
        help: entry.help ?? 'Read the command output; the repository owns this check.',
        owners: {
            extensions: [],
            filenames: [],
            tags: [],
            paths,
            languages: false,
            prettier_plugins: false,
            kinds: ['source', 'generated'],
        },
    };
}
