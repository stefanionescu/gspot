import type { Policy, RepositoryCheck } from '#cli/policy/normalize.ts';
import type { ScopeSelection } from '#cli/policy/resolve.ts';
import type { CheckSpec } from '#cli/configurations/schema.ts';

/**
 * Describe the persistent policy selection independently of files or tool availability.
 * @param policy
 * @param scope
 * @param spec
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
 * @param scope
 * @param spec
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
 * @param entry
 */
export function repositoryCheckSpec(entry: RepositoryCheck): CheckSpec {
    const { paths, ...definition } = entry;
    return {
        ...definition,
        level: 'recommended',
        runs: 'per-file-list',
        coverage: [],
        summary: entry.summary ?? `Runs the repository's own check ${entry.name}.`,
        why: 'The repository declared this command in gspot.toml as part of its gate.',
        help: entry.help ?? 'Read the command output; the repository owns this check.',
        claims: {
            extensions: [],
            filenames: [],
            tags: [],
            paths,
            from_languages: false,
            natures: ['source', 'generated'],
        },
    };
}
