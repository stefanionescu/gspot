// Initializes named kits without installing tools. Generates only policy and configuration.
import { QUIET_INIT } from '#tests/config/cli.ts';

/**
 * The init arguments that select the named kits.
 * @param configurations the configurations init selects by name
 * @returns the argument list
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Tests build init arguments that select kits this one way.
export function initArgs(configurations: string[]): string[] {
    return ['init', '--yes', '--kits', ...configurations, ...QUIET_INIT];
}
