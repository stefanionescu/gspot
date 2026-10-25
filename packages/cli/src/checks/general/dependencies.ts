import { posix } from 'node:path';
import { isTable } from '#cli/system/tables.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import { MISE_FILES } from '#cli/config/files/names.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { LOCKFILES } from '#cli/config/files/lockfiles.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { listEnclosingFolders } from '#cli/system/paths.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects/dependencies.ts';
import { readCachedText, findCachedText } from '#cli/system/files/reads.ts';
import { miseToolsSchema } from '#cli/schemas/checks/general/dependencies.ts';
import { IMPORTER_LOCKFILES } from '#cli/config/parsers/projects/lockfiles.ts';
import { findNearestLockfile, parseLockedSpecifiers } from '#cli/parsers/projects/lockfiles.ts';
import { readCachedPackageJson, readDependencySpecifiers } from '#cli/repository/dependencies.ts';

import {
    NPM_TOOL_PREFIX,
    LOCKFILE_DOWNLOADS,
    DOWNLOAD_PROTOCOLS,
    LOCKFILE_UPDATE_COMMANDS,
} from '#cli/config/checks/general/dependencies.ts';

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
                return message === undefined
                    ? []
                    : [buildFinding(planned, { file: path, line: index + 1 }, 'host', message)];
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
        .drop(1)
        .map((path) =>
            buildFinding(
                planned,
                { file: path, line: 1 },
                'foreign-lockfile',
                `This scope holds lockfiles of ${String(pathsByPackageManager.size)} package managers: ${listed}. Keep one.`,
            ),
        )
        .toArray();
}

/**
Reports lockfile downloads from other hosts or over plain HTTP, and lockfiles of a second package manager in the
scope.

@param session the repository and its tools.
@param planned the scope files and allowed registries.
@returns the findings.
*/
export function checkDependenciesLockfiles(session: Session, planned: PlannedCheck): Finding[] {
    const hosts = new Set(getTable(planned.scope.settings, 'dependencies')['allowed_registries']);
    return [
        ...checkForeignLockfiles(planned),
        ...planned.files.flatMap(({ path }) => {
            const pattern = LOCKFILE_DOWNLOADS.get(posix.basename(path));
            return pattern === undefined ? [] : checkFileHosts(session, planned, path, hosts, pattern);
        }),
    ];
}

function readExactVersion(value: unknown): string | undefined {
    const first: unknown = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'string') return first;
    const version = isTable(first) ? first['version'] : undefined;
    return typeof version === 'string' ? version : undefined;
}

function readMisePin(session: Session, path: string, tool: string): string | undefined {
    const text = findCachedText(session.reads, path);
    if (text === undefined) return undefined;
    const { tools } = parseTomlFile(path, text, miseToolsSchema);
    return readExactVersion(tools[tool] ?? tools[`${NPM_TOOL_PREFIX}${tool}`]);
}

function findMisePin(session: Session, folder: string, tool: string): { path: string; version: string } | undefined {
    const paths = listEnclosingFolders(folder).flatMap((base) => MISE_FILES.map((file) => posix.join(base, file)));
    for (const path of paths) {
        const version = readMisePin(session, path, tool);
        if (version !== undefined) return { path, version };
    }
    return undefined;
}

function splitPackageManager(field: string | undefined): { tool: string; version: string } | undefined {
    const pin = field?.split('+', 1)[0] ?? '';
    const separator = pin.lastIndexOf('@');
    return separator <= 0 ? undefined : { tool: pin.slice(0, separator), version: pin.slice(separator + 1) };
}

/**
Reports a packageManager field that names another version than the mise pin of the same package manager.

@param session the repository and its tools.
@param planned the scope and the run cache.
@returns a finding when the two versions differ.
*/
export function checkDependenciesPackageManagerPin(session: Session, planned: PlannedCheck): Finding[] {
    const folder = planned.scope.folder.path;
    const packageJsonPath = posix.join(folder, PACKAGE_JSON);
    const writtenPin = splitPackageManager(readCachedPackageJson(session.reads, packageJsonPath)?.packageManager);
    if (writtenPin === undefined) return [];
    const { tool, version } = writtenPin;
    const pin = findMisePin(session, folder, tool);
    if (pin === undefined || pin.version === version) return [];
    return [
        buildFinding(
            planned,
            { file: packageJsonPath, line: 1 },
            'package-manager-pin',
            `packageManager names ${tool} ${version}, but ${pin.path} pins ${tool} ${pin.version}. Write one version in both.`,
        ),
    ];
}

function compareSpecifiers(
    specifiers: Map<string, string>,
    locked: Map<string, string>,
    lockfilePath: string,
): string[] {
    const changed = [...specifiers].flatMap(([name, specifier]) => {
        const version = locked.get(name);
        if (version === specifier) return [];
        return [
            version === undefined
                ? `package.json declares ${name} ${specifier}, which ${lockfilePath} does not record.`
                : `package.json asks for ${name} ${specifier}, but ${lockfilePath} records ${version}.`,
        ];
    });
    const removed = locked
        .keys()
        .filter((name) => !specifiers.has(name))
        .map((name) => `${lockfilePath} records ${name}, which package.json no longer declares.`)
        .toArray();
    return [...changed, ...removed];
}

/**
Reports a package.json whose dependencies differ from what its lockfile records, which a frozen install refuses.

@param session the repository and its tools.
@param planned the scope and the run cache.
@returns one finding per dependency out of step with the lockfile.
*/
export function checkDependenciesStaleLockfile(session: Session, planned: PlannedCheck): Finding[] {
    const folder = planned.scope.folder.path;
    const packageJsonPath = posix.join(folder, PACKAGE_JSON);
    const specifiers = readDependencySpecifiers(session.reads, packageJsonPath);
    const found = findNearestLockfile(session.reads, folder, IMPORTER_LOCKFILES);
    if (specifiers === undefined || found === undefined) return [];
    const locked = parseLockedSpecifiers(found.lockfile, found.text, posix.join(found.base, found.lockfile)).get(
        posix.relative(found.base, folder),
    );
    if (locked === undefined) return [];
    const command = LOCKFILE_UPDATE_COMMANDS[found.lockfile];
    return compareSpecifiers(specifiers, locked, found.path).map((message) =>
        buildFinding(
            planned,
            { file: packageJsonPath, line: 1 },
            'stale-lockfile',
            `${message} Run ${command} and commit the lockfile.`,
        ),
    );
}
