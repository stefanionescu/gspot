// The one place gspot reads the environment: every variable it honors has a function here.

function isSet(name: string): boolean {
    const value = process.env[name];
    return value !== undefined && value !== '';
}

/**
 * True under a CI runner, which sets CI.
 * @returns whether CI is set
 */
export function isCi(): boolean {
    return isSet('CI');
}

/**
 * True when NO_COLOR asks for plain output.
 * @returns whether NO_COLOR is set
 */
export function isColorRefused(): boolean {
    return isSet('NO_COLOR');
}

/**
 * The parallelism GSPOT_JOBS asks for, when it names a positive integer.
 * @returns the count, or undefined
 */
export function jobsWanted(): number | undefined {
    const wanted = Number(process.env['GSPOT_JOBS'] ?? '');
    return Number.isSafeInteger(wanted) && wanted > 0 ? wanted : undefined;
}

/**
 * Where mise keeps its data, when MISE_DATA_DIR or XDG_DATA_HOME says so.
 * @returns the directory, or undefined for the default under the home directory
 */
export function miseHome(): string | undefined {
    if (isSet('MISE_DATA_DIR')) return process.env['MISE_DATA_DIR'];
    return isSet('XDG_DATA_HOME') ? `${process.env['XDG_DATA_HOME'] ?? ''}/mise` : undefined;
}

/**
 * True when GSPOT_RELEASE_TEST asks for the release test, which needs a registry and a built binary.
 * @returns whether the release test runs
 */
export function isReleaseTestWanted(): boolean {
    return process.env['GSPOT_RELEASE_TEST'] === '1';
}

/**
 * The repositories GSPOT_ACCEPTANCE names for the acceptance run, as absolute paths separated by a colon.
 * @returns the paths, empty when the variable is unset
 */
export function acceptanceRepositories(): string[] {
    return (process.env['GSPOT_ACCEPTANCE'] ?? '').split(':').filter((path) => path !== '');
}

/**
 * The whole environment with the undefined entries dropped, for spawning tools.
 * @returns the variables as strings
 */
export function environmentVariables(): Record<string, string> {
    const variables: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) if (value !== undefined) variables[key] = value;
    return variables;
}
