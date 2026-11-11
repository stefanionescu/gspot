import { join, posix } from 'node:path';

import semver from 'semver';

import {
    DEPENDENCY_RULES,
    DOWNLOAD_PROTOCOLS,
    LOCKFILE_KEY_SUFFIX,
    LOCKFILE_UPDATE_COMMANDS,
    MISE_FILES,
    NPM_TOOL_PREFIX,
    PACKAGE_MANAGER_HASH_SEPARATOR,
    PACKAGE_MANAGER_VERSION_SEPARATOR,
    STALE_LOCKFILE_SECTIONS,
    UNBUNDLED_PACKAGE_MANAGERS,
} from '#cli/config/configurations/general.ts';
import { IMPORTER_LOCKFILES, JAVASCRIPT_LOCKFILES, PACKAGE_JSON, PNPM_ROOT_IMPORTER } from '#cli/config/parsers.ts';
import { LOCKFILES } from '#cli/config/repository/javascript.ts';
import {
    LOCKFILE_EXPLANATIONS,
    PACKAGE_MANAGER_PIN_EXPLANATIONS,
} from '#cli/configurations/general/dependencies/explanations.ts';
import { parseCheckedFile } from '#cli/configurations/syntax.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import {
    findNearestLockfile,
    listLockfileUrls,
    listSpecifiers,
    SPECIFIER_PARSERS,
} from '#cli/parsers/projects/lockfiles.ts';
import { readPackageJson } from '#cli/repository/dependencies.ts';
import { isGspotPath } from '#cli/repository/files/classify.ts';
import { listWorkspaceFolders } from '#cli/repository/javascript/workspaces.ts';
import { miseToolsSchema } from '#cli/schemas/parsers.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { findText, readText } from '#cli/system/files/reads.ts';
import { listEnclosingFolders } from '#cli/system/paths.ts';
import { isTable } from '#cli/system/tables.ts';
import { getPosition } from '#cli/system/text.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding } from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';

function validateUrl(url: URL, hosts: Set<string>): string | undefined {
    if (url.protocol !== 'https:') return `${url.href} is not HTTPS.`;
    return hosts.has(url.host) ? undefined : `${url.host} is not an allowed registry host.`;
}

function findUrlOffset(text: string, url: string, start: number): number {
    let offset = text.indexOf(url, start);
    while (offset !== -1 && LOCKFILE_KEY_SUFFIX.test(text.slice(offset + url.length)))
        offset = text.indexOf(url, offset + url.length);
    return offset;
}

function validateLockfileHosts(session: Session, path: string, hosts: Set<string>): CheckFinding[] {
    const text = readText(session.cache, path);
    let nextOffset = 0;
    return listLockfileUrls(path, text).flatMap((url) => {
        const offset = findUrlOffset(text, url, nextOffset);
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
                      rule: DEPENDENCY_RULES.host,
                      message: message,
                  },
              ];
    });
}

function listForeignLockfiles(files: PlannedCheck['files']): CheckFinding[] {
    const pathsByPackageManager = new Map<string, string>();
    for (const file of files) {
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
            rule: DEPENDENCY_RULES.foreignLockfile,
            message: `This scope holds lockfiles of ${String(pathsByPackageManager.size)} package managers: ${listed}. Keep one.`,
        }))
        .toArray();
}

function getExactVersion(tools: Record<string, unknown>, tool: string): string | undefined {
    const value = tools[tool] ?? tools[`${NPM_TOOL_PREFIX}${tool}`];
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
        const text = findText(session.cache, path);
        if (text === undefined) continue;
        const parsed = parseCheckedFile(path, () => parseTomlFile(path, text, miseToolsSchema));
        if ('error' in parsed) {
            findings.push(parsed.error);
            continue;
        }
        const { tools } = parsed.value;
        const version = getExactVersion(tools, tool);
        if (version !== undefined && pin === undefined) pin = { path, version };
    }
    return { pin, findings };
}

function splitPackageManager(field: string | undefined): { tool: string; version: string } | undefined {
    const pin = field?.split(PACKAGE_MANAGER_HASH_SEPARATOR, 1)[0] ?? '';
    const separator = pin.lastIndexOf(PACKAGE_MANAGER_VERSION_SEPARATOR);
    return separator <= 0 ? undefined : { tool: pin.slice(0, separator), version: pin.slice(separator + 1) };
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

function listMissingPins(session: Session, folder: string): CheckFinding[] {
    const packageJsonPath = posix.join(folder, PACKAGE_JSON);
    return LOCKFILES.filter(
        ({ file, packageManager }) =>
            UNBUNDLED_PACKAGE_MANAGERS.includes(packageManager) &&
            findText(session.cache, posix.join(folder, file)) !== undefined &&
            findText(session.cache, packageJsonPath) !== undefined,
    ).map(({ packageManager }) => {
        const { pin } = findMiseFilePin(session, folder, packageManager);
        const version = semver.valid(pin?.version) ?? '<version>';
        return {
            file: packageJsonPath,
            line: 1,
            rule: DEPENDENCY_RULES.packageManagerPin,
            message: `CI installs only a pinned ${packageManager}. Add "packageManager": "${packageManager}@${version}" to ${packageJsonPath}.`,
        };
    });
}

function checkLockfiles(session: Session, planned: PlannedCheck): CheckFinding[] {
    const hosts = new Set(getTable(planned.scope.settings, 'dependencies')['allowed_registries']);
    const files = planned.files.filter(({ path }) => !isGspotPath(path));
    return [
        ...listForeignLockfiles(files),
        ...files.flatMap(({ path }) => {
            return (JAVASCRIPT_LOCKFILES as readonly string[]).includes(posix.basename(path))
                ? validateLockfileHosts(session, path, hosts)
                : [];
        }),
    ];
}

function checkPackageManagerPin(session: Session, planned: PlannedCheck): CheckFinding[] {
    const folder = planned.scope.path;
    const packageJsonPath = posix.join(folder, PACKAGE_JSON);
    const writtenPin = splitPackageManager(readPackageJson(session.cache, packageJsonPath)?.packageManager);
    if (writtenPin === undefined) return listMissingPins(session, folder);
    const { tool, version } = writtenPin;
    const { pin, findings } = findMiseFilePin(session, folder, tool);
    if (pin === undefined || pin.version === version) return findings;
    return [
        ...findings,
        {
            file: packageJsonPath,
            line: 1,
            rule: DEPENDENCY_RULES.packageManagerPin,
            message: `packageManager names ${tool} ${version}, but ${pin.path} pins ${tool} ${pin.version}. Write one version in both.`,
        },
    ];
}

function checkStaleLockfile(session: Session, planned: PlannedCheck): CheckFinding[] {
    const folder = planned.scope.path;
    const packageJsonPath = posix.join(folder, PACKAGE_JSON);
    const found = findNearestLockfile(session.cache, folder, IMPORTER_LOCKFILES);
    if (found === undefined) return [];
    const sections =
        found.lockfile === 'pnpm-lock.yaml'
            ? STALE_LOCKFILE_SECTIONS.filter((section) => section !== 'peerDependencies')
            : STALE_LOCKFILE_SECTIONS;
    const manifest = readPackageJson(session.cache, packageJsonPath);
    if (manifest === undefined) return [];
    const specifiers = listSpecifiers(manifest, sections);
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
        rule: DEPENDENCY_RULES.staleLockfile,
        message: `${message} Run ${command} and commit the lockfile.`,
    }));
}

export const DEPENDENCIES_CHECKS: Readonly<Record<string, CheckCode>> = {
    'dependencies/lockfiles': { check: checkLockfiles, explanations: LOCKFILE_EXPLANATIONS },
    'dependencies/package-manager-pin': {
        check: checkPackageManagerPin,
        explanations: PACKAGE_MANAGER_PIN_EXPLANATIONS,
    },
    'dependencies/stale-lockfile': { check: checkStaleLockfile },
};
