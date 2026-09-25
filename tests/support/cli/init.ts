// The init command line a planted repository runs: named configurations, nothing installed, nothing generated beyond policy and configuration.

/** The flags that keep init from touching the runner, hooks, CI, agent rules, and tool installation. */
export const QUIET_INIT = ['--no-runner', '--no-hooks', '--no-ci', '--no-rules', '--no-install'];

/**
 * The init arguments that select the named configurations and leave the named recommendations out.
 * @param configurations the configurations init selects by name
 * @param without the recommended configurations left out
 * @returns the argument list
 */
export function initArgs(configurations: string[], without: string[] = []): string[] {
    return [
        'init',
        '--yes',
        '--configurations',
        ...configurations,
        ...(without.length === 0 ? [] : ['--without', ...without]),
        ...QUIET_INIT,
    ];
}
