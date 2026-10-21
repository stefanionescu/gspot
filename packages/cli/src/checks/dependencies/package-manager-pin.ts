import { posix } from 'node:path';
import { isRecord } from '#cli/system/tables.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { findCachedText } from '#cli/system/files/reads.ts';
import { listEnclosingFolders } from '#cli/system/paths.ts';
import { parseTomlFile } from '#cli/parsers/toml/document.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependencies.ts';
import { readCachedPackageJson } from '#cli/repository/dependency-files.ts';
import { miseToolsSchema } from '#cli/schemas/checks/package-manager-pin.ts';
import { MISE_FILES, NPM_TOOL_PREFIX } from '#cli/config/checks/dependencies.ts';

function readPinnedVersion(value: unknown): string | undefined {
    const first: unknown = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'string') return first;
    const version = isRecord(first) ? first['version'] : undefined;
    return typeof version === 'string' ? version : undefined;
}

function readMisePin(session: Session, path: string, tool: string): string | undefined {
    const text = findCachedText(session.reads, path);
    if (text === undefined) return undefined;
    const { tools } = parseTomlFile(path, text, miseToolsSchema);
    return readPinnedVersion(tools[tool] ?? tools[`${NPM_TOOL_PREFIX}${tool}`]);
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
    const declared = field?.split('+', 1)[0] ?? '';
    const separator = declared.lastIndexOf('@');
    return separator <= 0 ? undefined : { tool: declared.slice(0, separator), version: declared.slice(separator + 1) };
}

/**
 * Reports a packageManager field that names another version than the mise pin of the same package manager.
 *
 * @param session the repository and its tools.
 * @param planned the scope and the run cache.
 * @returns a finding when the two versions differ.
 */
export function checkPackageManagerPin(session: Session, planned: PlannedCheck): Finding[] {
    const folder = planned.selection.scope.path;
    const packageJsonPath = posix.join(folder, PACKAGE_JSON);
    const declared = splitPackageManager(readCachedPackageJson(session.reads, packageJsonPath)?.packageManager);
    if (declared === undefined) return [];
    const { tool, version } = declared;
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
