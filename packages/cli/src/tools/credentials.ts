// Check lockfiles for credentials and redact package manager output.
import type { SpawnResult } from '#cli/types/system/processes.ts';

import {
    REDACTED,
    URL_CREDENTIALS,
    INSTALL_OUTPUT_LIMIT,
    LOCKFILE_URL_PASSWORD,
} from '#cli/config/tools/credentials.ts';

/**
 * Reject a generated lockfile that holds a configured credential in either URL form.
 *
 * @param lockfile the text that the package manager wrote.
 * @param credentials the raw and decoded registry secrets.
 * @param failure the error to throw, without credential values.
 */
export function assertCredentialFreeLockfile(lockfile: string, credentials: string[], failure: Error): void {
    if (LOCKFILE_URL_PASSWORD.test(lockfile)) throw failure;
    for (const credential of credentials) {
        if (lockfile.includes(credential) || lockfile.includes(encodeURIComponent(credential))) throw failure;
    }
}

/**
 * Read both encoded and decoded passwords from a registry or proxy URL.
 *
 * @param url the authored registry or proxy address.
 *
 * @returns the password forms to keep out of generated lockfiles and messages.
 */
export function extractUrlPasswords(url: string): string[] {
    const password = new URL(url).password;
    if (password.length === 0) return [];
    return [password, decodeURIComponent(password)];
}

/**
 * Keep the end of the install output once the configured and printed credentials go.
 *
 * @param result the captured package-manager streams.
 * @param credentials the secrets from the registry settings of the repository.
 *
 * @returns the redacted tail, or a sentence that says the tool printed nothing.
 */
export function redactInstallOutput(result: Pick<SpawnResult, 'stdout' | 'stderr'>, credentials: string[]): string {
    const secrets = [...new Set(credentials.filter((value) => value !== ''))]
        .flatMap((value) => [value, encodeURIComponent(value), Buffer.from(value).toString('base64')])
        .toSorted((left, right) => right.length - left.length);
    let output = `${result.stdout}\n${result.stderr}`;
    for (const secret of secrets) output = output.replaceAll(secret, REDACTED);
    output = output.replace(URL_CREDENTIALS, `$1${REDACTED}@`).trim();
    if (output === '') return 'The package manager printed no error output.';
    return output.length > INSTALL_OUTPUT_LIMIT
        ? `[Earlier output omitted]\n${output.slice(-INSTALL_OUTPUT_LIMIT)}`
        : output;
}
