import { posix } from 'node:path';
import type { Session } from '#cli/types/session.ts';
import { extractBaseName } from '#cli/system/paths.ts';
import { SQL_EXTENSION } from '#cli/config/files/names.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { PathContainer } from '#cli/types/manifests.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { readNamingDefaults } from '#cli/manifests/naming.ts';
import type { Identifier } from '#cli/types/checks/general/naming.ts';
import { REST_SEGMENT } from '#cli/config/checks/general/naming/naming.ts';
import { readNamingSettings } from '#cli/checks/general/naming/settings.ts';
import { listNamedFiles } from '#cli/checks/general/naming/source-names.ts';
import { validateIdentifiers } from '#cli/checks/general/naming/validation.ts';
import { CATEGORY_LABELS } from '#cli/config/checks/general/naming/languages.ts';

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

/**
The file name without its extensions, or the whole name of a .sql file.

@param path the file, relative to the repository root.
@param language the configuration that covers the file.
@param containers the bracket pairs that wrap path segments.
*/
export function buildFileIdentifier(path: string, language: string, containers: PathContainer[]): Identifier {
    const base = posix.basename(path);
    const name = language === 'sql' && base.endsWith(SQL_EXTENSION) ? base : extractBaseName(base);
    const named = parseSegmentName(
        name,
        containers.filter((container) => container.category !== 'folders'),
    ) ?? { name, category: 'files' };
    return {
        file: path,
        language,
        line: 1,
        column: 1,
        ...named,
        label: `${language} ${CATEGORY_LABELS[named.category]}`,
    };
}

/**
Builds an identifier for each folder above a file, from the top down, except dot folders.

@param path the file, relative to the repository root.
@param language the configuration that covers the file.
@param containers the bracket pairs that wrap path segments.
*/
export function buildFolderIdentifiers(path: string, language: string, containers: PathContainer[]): Identifier[] {
    const segments = path.split('/').slice(0, -1);
    return segments.flatMap((segment, index) => {
        const named = segment.startsWith('.')
            ? undefined
            : (parseSegmentName(segment, containers) ?? { name: segment, category: 'folders' });
        if (named === undefined || named.name === '') return [];
        const folder = segments.slice(0, index + 1).join('/');
        return [
            {
                file: path,
                language,
                line: 1,
                column: 1,
                ...named,
                folder,
                label: `${language} ${CATEGORY_LABELS[named.category]}`,
            },
        ];
    });
}

/**
Checks file and folder names against the naming settings.

@param session the repository and its tools.
@param planned the scope files to check.
@returns the findings.
*/
export function checkPaths(session: Session, planned: PlannedCheck): CheckFinding[] {
    const settings = readNamingSettings(session.settings, planned.scope);
    const containers = readNamingDefaults().path_containers;
    const identifiers = new Map<string, Identifier>();
    for (const { file, language } of listNamedFiles(planned)) {
        const names = [
            buildFileIdentifier(file.path, language, containers),
            ...buildFolderIdentifiers(file.path, language, containers),
        ];
        for (const identifier of names) {
            const key = identifier.folder ?? JSON.stringify([identifier.file, identifier.language, identifier.name]);
            const previous = identifiers.get(key);
            if (identifier.folder !== undefined) {
                const cases = settings.limitLookup(identifier.language, identifier.category).cases;
                identifier.addedCases = [...new Set([...(previous?.addedCases ?? []), ...cases])];
            }
            identifiers.set(key, identifier);
        }
    }
    return validateIdentifiers(planned, settings, [...identifiers.values()]);
}
