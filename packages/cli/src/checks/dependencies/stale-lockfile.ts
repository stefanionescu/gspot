import { posix } from 'node:path';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { findCachedText } from '#cli/system/files/reads.ts';
import { listEnclosingFolders } from '#cli/system/paths.ts';
import { parseLockedSpecifiers } from '#cli/parsers/lockfiles.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependencies.ts';
import { IMPORTER_LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { readDeclaredSpecifiers } from '#cli/repository/dependency-files.ts';
import { LOCKFILE_UPDATE_COMMANDS } from '#cli/config/checks/dependencies.ts';

function findImporterLockfile(session: Session, folder: string) {
    for (const base of listEnclosingFolders(folder)) {
        for (const lockfile of IMPORTER_LOCKFILES) {
            const path = posix.join(base, lockfile);
            const text = findCachedText(session.reads, path);
            if (text !== undefined) return { lockfile, path, base, text };
        }
    }
    return undefined;
}

function compareSpecifiers(declared: Map<string, string>, locked: Map<string, string>, lockfilePath: string): string[] {
    const changed = [...declared].flatMap(([name, specifier]) => {
        const recorded = locked.get(name);
        if (recorded === specifier) return [];
        return [
            recorded === undefined
                ? `package.json declares ${name} ${specifier}, which ${lockfilePath} does not record.`
                : `package.json asks for ${name} ${specifier}, but ${lockfilePath} records ${recorded}.`,
        ];
    });
    const removed = [...locked.keys()]
        .filter((name) => !declared.has(name))
        .map((name) => `${lockfilePath} records ${name}, which package.json no longer declares.`);
    return [...changed, ...removed];
}

/**
 * Reports a package.json whose dependencies differ from what its lockfile records, which a frozen install refuses.
 *
 * @param session the repository and its tools.
 * @param planned the scope and the run cache.
 * @returns one finding per dependency out of step with the lockfile.
 */
export function checkDependenciesStaleLockfile(session: Session, planned: PlannedCheck): Finding[] {
    const folder = planned.scope.folder.path;
    const packageJsonPath = posix.join(folder, PACKAGE_JSON);
    const declared = readDeclaredSpecifiers(session.reads, packageJsonPath);
    const found = findImporterLockfile(session, folder);
    if (declared === undefined || found === undefined) return [];
    const locked = parseLockedSpecifiers(found.lockfile, found.text, posix.join(found.base, found.lockfile)).get(
        posix.relative(found.base, folder),
    );
    if (locked === undefined) return [];
    const command = LOCKFILE_UPDATE_COMMANDS[found.lockfile];
    return compareSpecifiers(declared, locked, found.path).map((message) =>
        buildFinding(
            planned,
            { file: packageJsonPath, line: 1 },
            'stale-lockfile',
            `${message} Run ${command} and commit the lockfile.`,
        ),
    );
}
