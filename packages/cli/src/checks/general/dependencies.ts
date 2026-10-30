import { join, posix } from 'node:path';
import { isTable } from '#cli/system/tables.ts';
import { getPosition } from '#cli/system/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import type { Session } from '#cli/types/session.ts';
import { MISE_FILES } from '#cli/config/files/names.ts';
import { read, find } from '#cli/system/files/reads.ts';
import { LOCKFILES } from '#cli/config/files/lockfiles.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { listEnclosingFolders } from '#cli/system/paths.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { listWorkspaceFolders } from '#cli/repository/npm/workspaces.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects/dependencies.ts';
import { parseCheckedFile } from '#cli/checks/cross-configuration/syntax.ts';
import { miseToolsSchema } from '#cli/schemas/checks/general/dependencies.ts';
import { readCachedPackageJson, readDependencySpecifiers } from '#cli/repository/dependencies.ts';

import {
    IMPORTER_LOCKFILES,
    PNPM_ROOT_IMPORTER,
    JAVASCRIPT_LOCKFILES,
} from '#cli/config/parsers/projects/lockfiles.ts';
import {
    listSpecifiers,
    listLockfileUrls,
    SPECIFIER_PARSERS,
    findNearestLockfile,
} from '#cli/parsers/projects/lockfiles.ts';
import {
    RULES,
    NPM_TOOL_PREFIX,
    DOWNLOAD_PROTOCOLS,
    LOCKFILE_KEY_SUFFIX,
    STALE_LOCKFILE_SECTIONS,
    LOCKFILE_UPDATE_COMMANDS,
    PACKAGE_MANAGER_HASH_SEPARATOR,
    PACKAGE_MANAGER_VERSION_SEPARATOR,
} from '#cli/config/checks/general/dependencies.ts';

function validateUrl(url: URL, hosts: Set<string>): string | undefined {
    if (url.protocol !== 'https:') return `${url.href} is not HTTPS.`;
    return hosts.has(url.host) ? undefined : `${url.host} is not an allowed registry host.`;
}

function validateLockfileHosts(session: Session, path: string, hosts: Set<string>): CheckFinding[] {
    const text = read(session.reads, path);
    let nextOffset = 0;
    return listLockfileUrls(path, text).flatMap((url) => {
        let offset = text.indexOf(url, nextOffset);
        while (offset !== -1 && LOCKFILE_KEY_SUFFIX.test(text.slice(offset + url.length)))
            offset = text.indexOf(url, offset + url.length);
        nextOffset = offset === -1 ? nextOffset : offset + url.length;
        const parsed = URL.parse(url);
        const message =
            parsed !== null && DOWNLOAD_PROTOCOLS.has(parsed.protocol) ? validateUrl(parsed, hosts) : undefined;
        return message === undefined
            ? []
            : [
                  {
                      file: path,
                      ...getPosition(text, Math.max(0, offset)),
                      rule: RULES.host,
                      message: message,
                  },
              ];
    });
}

function listForeignLockfiles(planned: PlannedCheck): CheckFinding[] {
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
        .map((path) => ({
            file: path,
            line: 1,
            rule: RULES.foreignLockfile,
            message: `This scope holds lockfiles of ${String(pathsByPackageManager.size)} package managers: ${listed}. Keep one.`,
        }))
        .toArray();
}

/**
Reports lockfile downloads from other hosts or over plain HTTP, and lockfiles of a second package manager in the
scope.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
*/
export function checkDependenciesLockfiles(session: Session, planned: PlannedCheck): CheckFinding[] {
    const hosts = new Set(getTable(planned.scope.settings, 'dependencies')['allowed_registries']);
    return [
        ...listForeignLockfiles(planned),
        ...planned.files.flatMap(({ path }) => {
            return (JAVASCRIPT_LOCKFILES as readonly string[]).includes(posix.basename(path))
                ? validateLockfileHosts(session, path, hosts)
                : [];
        }),
    ];
}

function getExactVersion(value: unknown): string | undefined {
    const first: unknown = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'string') return first;
    const version = isTable(first) ? first['version'] : undefined;
    return typeof version === 'string' ? version : undefined;
}

function findMiseFilePin(
    session: Session,

    folder: string,
    tool: string,
): { pin: { path: string; version: string } | undefined; findings: CheckFinding[] } {
    const findings: CheckFinding[] = [];
    let pin: { path: string; version: string } | undefined;
    const paths = listEnclosingFolders(folder).flatMap((base) => MISE_FILES.map((file) => posix.join(base, file)));
    for (const path of paths) {
        const text = find(session.reads, path);
        if (text === undefined) continue;
        const parsed = parseCheckedFile(path, () => parseTomlFile(path, text, miseToolsSchema));
        if ('error' in parsed) {
            findings.push(parsed.error);
            continue;
        }
        const { tools } = parsed.value;
        const version = getExactVersion(tools[tool] ?? tools[`${NPM_TOOL_PREFIX}${tool}`]);
        if (version !== undefined && pin === undefined) pin = { path, version };
    }
    return { pin, findings };
}

function splitPackageManager(field: string | undefined): { tool: string; version: string } | undefined {
    const pin = field?.split(PACKAGE_MANAGER_HASH_SEPARATOR, 1)[0] ?? '';
    const separator = pin.lastIndexOf(PACKAGE_MANAGER_VERSION_SEPARATOR);
    return separator <= 0 ? undefined : { tool: pin.slice(0, separator), version: pin.slice(separator + 1) };
}

/**
Reports a packageManager field that names another version than the mise pin of the same package manager.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
*/
export function checkDependenciesPackageManagerPin(session: Session, planned: PlannedCheck): CheckFinding[] {
    const folder = planned.scope.path;
    const packageJsonPath = posix.join(folder, PACKAGE_JSON);
    const writtenPin = splitPackageManager(readCachedPackageJson(session.reads, packageJsonPath)?.packageManager);
    if (writtenPin === undefined) return [];
    const { tool, version } = writtenPin;
    const { pin, findings } = findMiseFilePin(session, folder, tool);
    if (pin === undefined || pin.version === version) return findings;
    return [
        ...findings,
        {
            file: packageJsonPath,
            line: 1,
            rule: RULES.packageManagerPin,
            message: `packageManager names ${tool} ${version}, but ${pin.path} pins ${tool} ${pin.version}. Write one version in both.`,
        },
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
@param planned the configured check and selected scope files.
*/
export function checkDependenciesStaleLockfile(session: Session, planned: PlannedCheck): CheckFinding[] {
    const folder = planned.scope.path;
    const packageJsonPath = posix.join(folder, PACKAGE_JSON);
    const found = findNearestLockfile(session.reads, folder, IMPORTER_LOCKFILES);
    if (found === undefined) return [];
    const sections =
        found.lockfile === 'pnpm-lock.yaml'
            ? STALE_LOCKFILE_SECTIONS.filter((section) => section !== 'peerDependencies')
            : STALE_LOCKFILE_SECTIONS;
    const specifiers = readDependencySpecifiers(session.reads, packageJsonPath, sections);
    if (specifiers === undefined) return [];
    let locked = new Map(
        SPECIFIER_PARSERS[found.lockfile](posix.join(found.base, found.lockfile), found.text).map(
            ([key, workspace]) => [key === PNPM_ROOT_IMPORTER ? '' : key, listSpecifiers(workspace, sections)],
        ),
    ).get(posix.relative(found.base, folder));
    if (locked === undefined) {
        const relative = posix.relative(found.base, folder);
        if (relative !== '' && !listWorkspaceFolders(join(session.root, found.base)).includes(relative)) return [];
        locked = new Map();
    }
    const command = LOCKFILE_UPDATE_COMMANDS[found.lockfile];
    return compareSpecifiers(specifiers, locked, found.path).map((message) => ({
        file: packageJsonPath,
        line: 1,
        rule: RULES.staleLockfile,
        message: `${message} Run ${command} and commit the lockfile.`,
    }));
}
