import { posix } from 'node:path';
import { buildFinding } from '#cli/checks/finding.ts';
import { findLockfile } from '#cli/repository/classify.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import type { Finding, CheckInput } from '#cli/types/checks/run/check.ts';
import { LOCKFILE_URL, NPM_DOWNLOAD } from '#cli/config/checks/general/dependencies.ts';

function validateUrl(url: URL, hosts: Set<string>): string | undefined {
    if (url.protocol !== 'https:') return `${url.href} is not HTTPS.`;
    return hosts.has(url.host) ? undefined : `${url.host} is not an allowed registry host.`;
}

function checkFileHosts(input: CheckInput, path: string, hosts: Set<string>): Finding[] {
    const lines = readCachedBytes(input.reads, path).toString('utf8').split('\n');
    // An npm lockfile also holds funding pages and deprecation notes; only its resolved field names a download.
    const isNpm = findLockfile(path)?.packageManager === 'npm';
    return lines.flatMap((text, index) =>
        (isNpm
            ? text.matchAll(NPM_DOWNLOAD).map((match) => match[1] ?? '')
            : text.matchAll(LOCKFILE_URL).map((match) => match[0])
        )
            .flatMap((url) => {
                const message = URL.canParse(url) ? validateUrl(new URL(url), hosts) : undefined;
                if (message === undefined) return [];
                return [buildFinding(input, { file: path, line: index + 1 }, 'host', message)];
            })
            .toArray(),
    );
}

function checkForeignLockfiles(input: CheckInput): Finding[] {
    const kinds = new Map<string, string>();
    for (const file of input.files) {
        const lockfile = findLockfile(file.path);
        const kind =
            lockfile !== undefined && 'configuration' in lockfile && lockfile.configuration === 'javascript'
                ? lockfile.packageManager
                : undefined;
        if (kind !== undefined && !kinds.has(kind)) kinds.set(kind, file.path);
    }
    if (kinds.size <= 1) return [];
    const listed = kinds.values().toArray().join(', ');
    return kinds
        .values()
        .toArray()
        .slice(1)
        .map((path) =>
            buildFinding(
                input,
                { file: path, line: 1 },
                'foreign-lockfile',
                `The repository holds lockfiles of ${String(kinds.size)} package managers: ${listed}. Keep one.`,
            ),
        );
}

/**
 * Checks the registry hosts in tracked npm, pnpm, Yarn, and text Bun lockfiles.
 * @param input the scope files and allowed registries.
 * @returns the findings.
 */
export function checkLockfiles(input: CheckInput): Finding[] {
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
                name !==
                    (
                        LOCKFILES.find(
                            ({ packageManager, file }) => packageManager === 'bun' && file.endsWith('b'),
                        ) as (typeof LOCKFILES)[number]
                    ).file
            );
        });
    return [...checkForeignLockfiles(input), ...paths.flatMap((path) => checkFileHosts(input, path, hosts))];
}
