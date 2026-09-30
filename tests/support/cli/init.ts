// Initializes named kits without installing tools. Generates only policy and configuration.
import { QUIET_INIT } from '#tests/inputs/cli.ts';

/**
 * The init arguments that select the named kits and leave the named recommendations out.
 * @param configurations the configurations init selects by name
 * @param without the recommended kits left out
 * @returns the argument list
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Tests build init arguments that select kits and leave recommendations out this one way.
export function initArgs(configurations: string[], without: string[] = []): string[] {
    return [
        'init',
        '--yes',
        '--kits',
        ...configurations,
        ...(without.length === 0 ? [] : ['--without', ...without]),
        ...QUIET_INIT,
    ];
}
