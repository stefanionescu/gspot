import type { SpawnResult } from '#cli/types/platform/runtime.ts';
import { environmentVariables } from '#cli/platform/environment.ts';

import {
    URL_CREDENTIALS,
    AUTHORIZATION_HEADER,
    INSTALL_OUTPUT_LIMIT,
    CREDENTIAL_ASSIGNMENT,
    SECRET_ENVIRONMENT_KEY,
} from '#cli/config/tools/install.ts';

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

/**
 * Read both encoded and decoded passwords from a registry or proxy URL.
 * @param source the authored URL
 * @returns password representations excluded from generated locks and diagnostics
 */
export function registryPasswords(source: string): string[] {
    const password = new URL(source).password;
    if (password.length === 0) return [];
    return [password, decodeURIComponent(password)];
}

/**
 * Retain bounded installation output after removing configured and printed credentials.
 * @param result the captured package-manager streams
 * @param credentials credentials read from repository registry settings
 * @returns the redacted tail, or an explicit absence of diagnostics
 */
export function installationDiagnostics(result: Pick<SpawnResult, 'stdout' | 'stderr'>, credentials: string[]): string {
    const inherited = Object.entries(environmentVariables())
        .filter(([key]) => SECRET_ENVIRONMENT_KEY.test(key))
        .map(([, value]) => value);
    const secrets = [...new Set([...credentials, ...inherited].filter((value) => value !== ''))]
        .flatMap((value) => [value, encodeURIComponent(value), Buffer.from(value).toString('base64')])
        .toSorted((left, right) => right.length - left.length);
    let output = `${result.stdout}\n${result.stderr}`;
    for (const secret of secrets) output = output.replaceAll(secret, '[redacted]');
    output = output
        .replace(URL_CREDENTIALS, '$1[redacted]@')
        .replace(CREDENTIAL_ASSIGNMENT, '$1[redacted]')
        .replace(AUTHORIZATION_HEADER, '$1[redacted]')
        .trim();
    if (output === '') return 'The package manager provided no diagnostics.';
    return output.length > INSTALL_OUTPUT_LIMIT
        ? `[Earlier output omitted]\n${output.slice(-INSTALL_OUTPUT_LIMIT)}`
        : output;
}
