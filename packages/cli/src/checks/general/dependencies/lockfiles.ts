import { posix } from 'node:path';
import { getTable } from '#cli/settings/scopes.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { LOCKFILES, JAVASCRIPT_LOCKFILES } from '#cli/config/parsers/projects/lockfiles.ts';
import { LOCKFILE_DOWNLOADS, DOWNLOAD_PROTOCOLS } from '#cli/config/checks/general/dependencies/lockfiles.ts';

function validateUrl(url: URL, hosts: Set<string>): string | undefined {
    if (url.protocol !== 'https:') return `${url.href} is not HTTPS.`;
    return hosts.has(url.host) ? undefined : `${url.host} is not an allowed registry host.`;
}

function checkFileHosts(
    session: Session,
    planned: PlannedCheck,
    path: string,
    hosts: Set<string>,
    pattern: RegExp,
): Finding[] {
    const lines = readCachedText(session.reads, path).split('\n');
    return lines.flatMap((text, index) =>
        text
            .matchAll(pattern)
            .map((match) => match[1] ?? '')
            .flatMap((url) => {
                const parsed = URL.parse(url);
                const message =
                    parsed !== null && DOWNLOAD_PROTOCOLS.has(parsed.protocol) ? validateUrl(parsed, hosts) : undefined;
                if (message === undefined) return [];
                return [buildFinding(planned, { file: path, line: index + 1 }, 'host', message)];
            })
            .toArray(),
    );
}

function checkForeignLockfiles(planned: PlannedCheck): Finding[] {
    const pathsByPackageManager = new Map<string, string>();
    for (const file of planned.files) {
        const lockfile = LOCKFILES.find((each) => each.file === posix.basename(file.path));
        const kind =
            lockfile !== undefined && 'configuration' in lockfile && lockfile.configuration === 'javascript'
                ? lockfile.packageManager
                : undefined;
        if (kind !== undefined && !pathsByPackageManager.has(kind)) pathsByPackageManager.set(kind, file.path);
    }
    if (pathsByPackageManager.size <= 1) return [];
    const listed = pathsByPackageManager.values().toArray().join(', ');
    return pathsByPackageManager
        .values()
        .toArray()
        .slice(1)
        .map((path) =>
            buildFinding(
                planned,
                { file: path, line: 1 },
                'foreign-lockfile',
                `This scope holds lockfiles of ${String(pathsByPackageManager.size)} package managers: ${listed}. Keep one.`,
            ),
        );
}

/**
 * Reports lockfile downloads from other hosts or over plain HTTP, and lockfiles of a second package manager in the
 * scope.
 *
 * @param session the repository and its tools.
 * @param planned the scope files and allowed registries.
 * @returns the findings.
 */
export function checkDependenciesLockfiles(session: Session, planned: PlannedCheck): Finding[] {
    const hosts = new Set(getTable(planned.scope.settings, 'dependencies')['allowed_registries']);
    const lockfiles = new Set<string>(JAVASCRIPT_LOCKFILES);
    const paths = planned.files.map((file) => file.path).filter((path) => lockfiles.has(posix.basename(path)));
    return [
        ...checkForeignLockfiles(planned),
        ...paths.flatMap((path) => {
            const pattern = LOCKFILE_DOWNLOADS.get(posix.basename(path));
            return pattern === undefined ? [] : checkFileHosts(session, planned, path, hosts, pattern);
        }),
    ];
}
