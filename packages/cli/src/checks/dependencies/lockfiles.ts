import { posix } from 'node:path';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { getTable } from '#cli/settings/scope-settings.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { LOCKFILE_URL, NPM_DOWNLOAD } from '#cli/config/checks/dependencies.ts';
import { LOCKFILES, JAVASCRIPT_LOCKFILES } from '#cli/config/parsers/lockfiles.ts';

function validateUrl(url: URL, hosts: Set<string>): string | undefined {
    if (url.protocol !== 'https:') return `${url.href} is not HTTPS.`;
    return hosts.has(url.host) ? undefined : `${url.host} is not an allowed registry host.`;
}

function checkFileHosts(session: Session, planned: PlannedCheck, path: string, hosts: Set<string>): Finding[] {
    const lines = readCachedText(session.reads, path).split('\n');
    // An npm lockfile also holds funding pages and deprecation notes; only its resolved field names a download.
    const isNpm = LOCKFILES.find((entry) => entry.file === posix.basename(path))?.packageManager === 'npm';
    return lines.flatMap((text, index) =>
        (isNpm
            ? text.matchAll(NPM_DOWNLOAD).map((match) => match[1] ?? '')
            : text.matchAll(LOCKFILE_URL).map((match) => match[0])
        )
            .flatMap((url) => {
                const message = URL.canParse(url) ? validateUrl(new URL(url), hosts) : undefined;
                if (message === undefined) return [];
                return [buildFinding(planned, { file: path, line: index + 1 }, 'host', message)];
            })
            .toArray(),
    );
}

function checkForeignLockfiles(planned: PlannedCheck): Finding[] {
    const pathsByPackageManager = new Map<string, string>();
    for (const file of planned.files) {
        const lockfile = LOCKFILES.find((entry) => entry.file === posix.basename(file.path));
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
        ...paths.flatMap((path) => checkFileHosts(session, planned, path, hosts)),
    ];
}
