// The one place a test changes the environment that it and the tools it spawns read.

/**
 * Sets or clears one environment variable for this process and the tools it spawns.
 * @param name the variable
 * @param value the new value, or undefined to clear it
 */
export function setEnvironmentVariable(name: string, value: string | undefined): void {
    if (value === undefined) Reflect.deleteProperty(process.env, name);
    else process.env[name] = value;
}
