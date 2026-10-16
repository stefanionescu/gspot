// Check lockfiles for credentials and redact installer output.
import type { SpawnResult } from '#cli/types/system/processes.ts';

import {
    REDACTED,
    URL_CREDENTIALS,
    INSTALL_OUTPUT_LIMIT,
    LOCKFILE_URL_PASSWORD,
} from '#cli/config/tools/credentials.ts';

/**
 * Reject a generated lockfile containing a configured credential in either URL representation.
 *
 * @param lockfile the manager's lockfile output.
 * @param credentials the raw and decoded registry credentials.
 * @param failure the installation owner's error, without credential values.
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
 * @param url the authored URL.
 *
 * @returns password representations excluded from generated lockfiles and diagnostics.
 */
export function extractUrlPasswords(url: string): string[] {
    const password = new URL(url).password;
    if (password.length === 0) return [];
    return [password, decodeURIComponent(password)];
}

/**
 * Retain bounded installation output after removing configured and printed credentials.
 *
 * @param result the captured package-manager streams.
 * @param credentials credentials read from repository registry settings.
 *
 * @returns the redacted tail, or an explicit absence of diagnostics.
 */
export function redactInstallOutput(result: Pick<SpawnResult, 'stdout' | 'stderr'>, credentials: string[]): string {
    const secrets = [...new Set(credentials.filter((value) => value !== ''))]
        .flatMap((value) => [value, encodeURIComponent(value), Buffer.from(value).toString('base64')])
        .toSorted((left, right) => right.length - left.length);
    let output = `${result.stdout}\n${result.stderr}`;
    for (const secret of secrets) output = output.replaceAll(secret, REDACTED);
    output = output.replace(URL_CREDENTIALS, `$1${REDACTED}@`).trim();
    if (output === '') return 'The package manager provided no diagnostics.';
    return output.length > INSTALL_OUTPUT_LIMIT
        ? `[Earlier output omitted]\n${output.slice(-INSTALL_OUTPUT_LIMIT)}`
        : output;
}
