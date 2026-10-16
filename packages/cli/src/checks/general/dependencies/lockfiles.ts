import { posix } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { findLockfile } from '#cli/repository/classify.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';
import { LOCKFILE_URL, NPM_DOWNLOAD, BINARY_BUN_LOCKFILE } from '#cli/config/checks/general/dependencies.ts';

function urlMessage(url: URL, hosts: Set<string>): string | undefined {
    if (url.protocol !== 'https:') return `${url.href} is not HTTPS.`;
    return hosts.has(url.host) ? undefined : `${url.host} is not an allowed registry host.`;
}

function fileFindings(input: CheckInput, path: string, hosts: Set<string>): Finding[] {
    const lines = readCachedBytes(input.reads, path).toString('utf8').split('\n');
    // An npm lockfile also holds funding pages and deprecation notes; only its resolved field names a download.
    const isNpm = findLockfile(path)?.client === 'npm';
    return lines.flatMap((text, index) =>
        (isNpm
            ? text.matchAll(NPM_DOWNLOAD).map((match) => match[1] ?? '')
            : text.matchAll(LOCKFILE_URL).map((match) => match[0])
        )
            .flatMap((url) => {
                const diagnostic = URL.canParse(url) ? urlMessage(new URL(url), hosts) : undefined;
                if (diagnostic === undefined) return [];
                return [findingAt(input, { file: path, line: index + 1 }, 'host', diagnostic)];
            })
            .toArray(),
    );
}

/**
 * The findings of the lockfile host check over tracked npm, pnpm, Yarn, and text Bun lockfiles.
 * @param input the check input.
 * @returns the findings.
 */
export function lockfileHosts(input: CheckInput): Finding[] {
    const hosts = new Set(input.selection.view.options('dependencies')['allowed_registries']);
    const paths = input.files
        .map((file) => file.path)
        .filter((path) => {
            const name = posix.basename(path);
            const entry = findLockfile(name);
            return (
                entry !== undefined &&
                'configuration' in entry &&
                entry.configuration === 'javascript' &&
                name !== BINARY_BUN_LOCKFILE
            );
        });
    return paths.flatMap((path) => fileFindings(input, path, hosts));
}
