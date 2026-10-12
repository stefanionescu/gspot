// Changes environment variables for a scope and restores them when it ends.

/**
 * Sets or clears one environment variable for this process and the tools it spawns.
 * @param name the variable.
 * @param value the new value, or undefined to clear it.
 */
function setEnvironmentVariable(name: string, value: string | undefined): void {
    if (value === undefined) Reflect.deleteProperty(process.env, name);
    else process.env[name] = value;
}

/**
 * Restore test-owned variables when the test scope ends, including after failures.
 * @param variables values to set or clear for this scope.
 * @returns the restoration resource.
 */
export function useEnvironment(variables: Record<string, string | undefined>): Disposable {
    const previous = Object.fromEntries(Object.keys(variables).map((name) => [name, process.env[name]]));
    for (const [name, value] of Object.entries(variables)) setEnvironmentVariable(name, value);
    return {
        [Symbol.dispose]() {
            for (const [name, value] of Object.entries(previous)) setEnvironmentVariable(name, value);
        },
    };
}
