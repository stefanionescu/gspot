import { posix } from 'node:path';

import { SQL_EXTENSION } from '#cli/config/configurations/infrastructure.ts';
import { CATEGORY_LABELS, REST_SEGMENT } from '#cli/config/configurations/naming.ts';
import { readNamingSettings } from '#cli/configurations/general/naming/checks/settings.ts';
import { listNamedFiles } from '#cli/configurations/general/naming/checks/source-names.ts';
import { validateIdentifiers } from '#cli/configurations/general/naming/checks/validation.ts';
import { NAMING_EXPLANATIONS } from '#cli/configurations/general/naming/explanations.ts';
import { readNamingDefaults } from '#cli/manifests/read.ts';
import { extractBaseName } from '#cli/system/paths.ts';
import type { Identifier, PathContainer } from '#cli/types/configurations/general.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { Session } from '#cli/types/tools.ts';

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

function checkPaths(session: Session, planned: PlannedCheck): CheckFinding[] {
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
    return validateIdentifiers(planned, settings, identifiers.values().toArray());
}

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

export const NAMING_PATHS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'naming/paths': { check: checkPaths, explanations: NAMING_EXPLANATIONS },
};
