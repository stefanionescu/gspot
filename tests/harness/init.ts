// The arguments and options of quiet init: named configurations without runner, hooks, CI, agent rules, or installation.
import { QUIET_INIT } from '#tests/config/harness/init.ts';
import type { InitOptions } from '#cli/types/lifecycle/selection.ts';

/**
 * The init arguments that select the named configurations.
 * @param configurations the configurations init selects by name
 * @returns the argument list
 */

export function buildInitArguments(configurations: string[]): string[] {
    return ['init', '--yes', '--configurations', ...configurations, ...QUIET_INIT];
}

/**
 * The options of an in-process init that asks nothing and installs no tools.
 * @param cwd the repository
 * @param overrides the options a test changes or adds, such as the hooks, CI, runner, and rules choices
 * @returns the init options
 */

export function buildInitOptions(cwd: string, overrides: Partial<InitOptions> = {}): InitOptions {
    return {
        cwd,
        yes: true,
        isDryRun: false,
        install: false,
        hooks: false,
        runner: 'none',
        ci: 'none',
        agentRules: false,
        ...overrides,
    };
}
