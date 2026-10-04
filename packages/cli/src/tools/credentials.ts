/**
 * Reject a generated lock containing a configured credential in either URL representation.
 * @param lock the native manager's lock output
 * @param credentials the raw and decoded registry credentials
 * @param failure the installation owner's error, without credential values
 */
export function assertCredentialFreeLock(lock: string, credentials: string[], failure: Error): void {
    for (const credential of credentials) {
        if (lock.includes(credential) || lock.includes(encodeURIComponent(credential))) throw failure;
    }
}
/**
 * Add a connection setting under an unused environment variable and return its reference.
 * @param env the installation environment receiving the value
 * @param prefix the variable prefix for this package manager
 * @param value the connection setting kept out of generated files
 * @returns a package-manager environment reference
 */
export function addEnvironmentReference(env: Record<string, string>, prefix: string, value: string): string {
    let index = 0;
    while (Object.hasOwn(env, `${prefix}${String(index)}`)) index += 1;
    const name = `${prefix}${String(index)}`;
    env[name] = value;
    return `\${${name}}`;
}
