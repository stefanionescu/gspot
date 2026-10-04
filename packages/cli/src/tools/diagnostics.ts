// Redact native package-manager failures before exposing their useful diagnostics.
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
