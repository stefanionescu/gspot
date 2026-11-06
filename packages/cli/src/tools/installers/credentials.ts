import { unescape } from 'node:querystring';

import {
    EMPTY_OUTPUT_MESSAGE,
    INSTALL_OUTPUT_LIMIT,
    LOCKFILE_URL_PASSWORD,
    REDACTED,
    URL_CREDENTIALS,
} from '#cli/config/tools/installers.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { SpawnResult } from '#cli/types/system.ts';

export function assertCredentialFreeLockfile(lockfile: string, credentials: string[], message: string): void {
    if (LOCKFILE_URL_PASSWORD.test(lockfile)) throw new GspotError('install', message);
    for (const credential of credentials) {
        if (lockfile.includes(credential) || lockfile.includes(encodeURIComponent(credential)))
            throw new GspotError('install', message);
    }
}

export function extractUrlPasswords(url: string): string[] {
    if (!URL.canParse(url)) return [];
    const password = new URL(url).password;
    return password.length === 0 ? [] : [password, unescape(password)];
}

export function redactInstallOutput(result: Pick<SpawnResult, 'stdout' | 'stderr'>, credentials: string[]): string {
    const secrets = [...new Set(credentials.filter((value) => value !== ''))]
        .flatMap((value) => [value, encodeURIComponent(value), Buffer.from(value).toString('base64')])
        .toSorted((left, right) => right.length - left.length);
    let output = `${result.stdout}\n${result.stderr}`;
    for (const secret of secrets) output = output.replaceAll(secret, () => REDACTED);
    output = output.replace(URL_CREDENTIALS, (_url, scheme: string) => `${scheme}${REDACTED}@`).trim();
    if (output === '') return EMPTY_OUTPUT_MESSAGE;
    return output.length > INSTALL_OUTPUT_LIMIT
        ? `[Earlier output omitted]\n${output.slice(-INSTALL_OUTPUT_LIMIT)}`
        : output;
}
