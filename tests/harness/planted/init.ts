// Initializes named kits without installing tools. Generates only policy and configuration.
import { QUIET_INIT } from '#tests/config/cli.ts';
import type { InitOptions } from '#cli/types/commands/init.ts';

/**
 * The init arguments that select the named kits.
 * @param configurations the configurations init selects by name
 * @returns the argument list
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Tests build init arguments that select kits this one way.
export function initArgs(configurations: string[]): string[] {
    return ['init', '--yes', '--kits', ...configurations, ...QUIET_INIT];
}

/**
 * The options of an in-process init that asks nothing, prints JSON, and installs no tools.
 * @param cwd the repository
 * @param overrides the options a test changes or adds, such as the hooks, CI, runner, and rules choices
 * @returns the init options
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Init tests change one or two options of the same quiet defaults.
export function initOptions(cwd: string, overrides: Partial<InitOptions> = {}): InitOptions {
    return { cwd, yes: true, isDryRun: false, json: true, install: false, ...overrides };
}
