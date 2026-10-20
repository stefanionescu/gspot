import { posix } from 'node:path';
import { buildFinding } from '#cli/runs/finding.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import type { Finding, CheckInput } from '#cli/types/runs/check.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependency-files.ts';
import { readLockedSpecifiers } from '#cli/parsers/locked-specifiers.ts';
import { readDeclaredSpecifiers } from '#cli/checks/dependencies/package-json.ts';
import { IMPORTER_LOCKFILES, LOCKFILE_UPDATE_COMMANDS } from '#cli/config/parsers/lockfiles.ts';

function findImporterLockfile(input: CheckInput, folder: string) {
    const segments = folder === '' ? [] : folder.split('/');
    for (let depth = segments.length; depth >= 0; depth -= 1) {
        const base = segments.slice(0, depth).join('/');
        for (const lockfile of IMPORTER_LOCKFILES) {
            const path = posix.join(base, lockfile);
            const text = readCachedText(input.reads, path);
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
 * @param input the scope and the run cache.
 * @returns one finding per dependency out of step with the lockfile.
 */
export function checkStaleLockfile(input: CheckInput): Finding[] {
    const folder = input.selection.scope.path;
    const manifest = posix.join(folder, PACKAGE_JSON);
    const declared = readDeclaredSpecifiers(input, manifest);
    const found = findImporterLockfile(input, folder);
    if (declared === undefined || found === undefined) return [];
    const locked = readLockedSpecifiers(found.lockfile, found.text).get(posix.relative(found.base, folder));
    if (locked === undefined) return [];
    const command = LOCKFILE_UPDATE_COMMANDS[found.lockfile];
    return compareSpecifiers(declared, locked, found.path).map((message) =>
        buildFinding(
            input,
            { file: manifest, line: 1 },
            'stale-lockfile',
            `${message} Run ${command} and commit the lockfile.`,
        ),
    );
}
