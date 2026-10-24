import { posix } from 'node:path';
import type { Session } from '#cli/types/session.ts';
import { extractBaseName } from '#cli/system/paths.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { SQL_EXTENSION } from '#cli/config/files/names.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { readNamingDefaults } from '#cli/configurations/naming.ts';
import { validateIdentifiers } from '#cli/checks/general/naming/rules.ts';
import { REST_SEGMENT } from '#cli/config/checks/general/naming/paths.ts';
import { readNamingSettings } from '#cli/checks/general/naming/settings.ts';
import { listNamedFiles } from '#cli/checks/general/naming/source-names.ts';
import type { Identifier, PathContainer } from '#cli/types/checks/general/naming.ts';
import { createIdentifier } from '#cli/checks/general/naming/languages/identifier.ts';

function parseSegmentName(
    segment: string,
    containers: PathContainer[],
): Pick<Identifier, 'name' | 'category'> | undefined {
    const bracket = containers.find(
        (container) => segment.startsWith(container.open) && segment.endsWith(container.close),
    );
    if (bracket === undefined) return undefined;
    const inner = segment.slice(bracket.open.length, segment.length - bracket.close.length);
    return { name: inner.replace(REST_SEGMENT, ''), category: bracket.category };
}

function listPathIdentifiers(planned: PlannedCheck): Identifier[] {
    const containers = readNamingDefaults().path_containers;
    const seen = new Set<string>();
    return listNamedFiles(planned).flatMap(({ file, language }) => {
        const all = [
            buildFileIdentifier(file.path, language, containers),
            ...buildFolderIdentifiers(file.path, language, containers),
        ];
        return all.filter((identifier) => {
            const key = JSON.stringify([identifier.folder ?? identifier.file, identifier.language, identifier.name]);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    });
}

/**
Builds the identifier of a file name: the name without its extension, or the whole file name for a SQL migration.

@param path the file, relative to the repository root.
@param language the configuration that covers the file.
@param containers the bracket pairs that wrap path segments.
@returns the name to check and its category.
*/
export function buildFileIdentifier(path: string, language: string, containers: PathContainer[]): Identifier {
    const base = posix.basename(path);
    const name = language === 'sql' && base.endsWith(SQL_EXTENSION) ? base : extractBaseName(base);
    const named = parseSegmentName(
        name,
        containers.filter((container) => container.category !== 'folders'),
    ) ?? { name, category: 'files' };
    return createIdentifier({ file: path, language }, { line: 1, column: 1, ...named });
}

/**
Builds an identifier for each folder above a file, from the top down, except dot folders.

@param path the file, relative to the repository root.
@param language the configuration that covers the file.
@param containers the bracket pairs that wrap path segments.
@returns one identifier per nonempty folder without a leading dot.
*/
export function buildFolderIdentifiers(path: string, language: string, containers: PathContainer[]): Identifier[] {
    const segments = path.split('/').slice(0, -1);
    return segments.flatMap((segment, index) => {
        const named = segment.startsWith('.')
            ? undefined
            : (parseSegmentName(segment, containers) ?? { name: segment, category: 'folders' });
        if (named === undefined || named.name === '') return [];
        const folder = segments.slice(0, index + 1).join('/');
        return [createIdentifier({ file: path, language }, { line: 1, column: 1, ...named, folder })];
    });
}

/**
Checks file and folder names against the naming settings.

@param session the repository and its tools.
@param planned the scope files to check.
@returns the findings.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The check registry calls it by its check name.
export function checkNamingPaths(session: Session, planned: PlannedCheck): Finding[] {
    const settings = readNamingSettings(session.settingsFile.settings, planned.scope);
    return validateIdentifiers(planned, settings, listPathIdentifiers(planned));
}
