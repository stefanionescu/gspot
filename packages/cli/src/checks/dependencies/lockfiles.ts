import { posix } from 'node:path';
import { buildFinding } from '#cli/runs/finding.ts';
import { getTable } from '#cli/settings/scope-view.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { findLockfile } from '#cli/repository/classify.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import { JAVASCRIPT_LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { LOCKFILE_URL, NPM_DOWNLOAD } from '#cli/config/checks/dependencies.ts';

function validateUrl(url: URL, hosts: Set<string>): string | undefined {
    if (url.protocol !== 'https:') return `${url.href} is not HTTPS.`;
    return hosts.has(url.host) ? undefined : `${url.host} is not an allowed registry host.`;
}

function checkFileHosts(session: Session, planned: PlannedCheck, path: string, hosts: Set<string>): Finding[] {
    const lines = readCachedText(session.reads, path).split('\n');
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
                return [buildFinding(planned, { file: path, line: index + 1 }, 'host', message)];
            })
            .toArray(),
    );
}

function checkForeignLockfiles(planned: PlannedCheck): Finding[] {
    const kinds = new Map<string, string>();
    for (const file of planned.files) {
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
                planned,
                { file: path, line: 1 },
                'foreign-lockfile',
                `The repository holds lockfiles of ${String(kinds.size)} package managers: ${listed}. Keep one.`,
            ),
        );
}

/**
 * Checks the registry hosts in tracked npm, pnpm, Yarn, and text Bun lockfiles.
 *
 * @param session the repository and its tools.
 * @param planned the scope files and allowed registries.
 * @returns the findings.
 */
export function checkLockfiles(session: Session, planned: PlannedCheck): Finding[] {
    const hosts = new Set(getTable(planned.selection.view, 'dependencies')['allowed_registries']);
    const lockfiles = new Set<string>(JAVASCRIPT_LOCKFILES);
    const paths = planned.files.map((file) => file.path).filter((path) => lockfiles.has(posix.basename(path)));
    return [
        ...checkForeignLockfiles(planned),
        ...paths.flatMap((path) => checkFileHosts(session, planned, path, hosts)),
    ];
}
