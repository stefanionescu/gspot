import { posix } from 'node:path';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import { type Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { findScopeFolder } from '#cli/repository/scopes.ts';
import { findCachedText } from '#cli/system/files/reads.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { readComposeDocuments } from '#cli/checks/infrastructure/docker/compose.ts';
import { DOCKERFILE_NAME, DOCKERFILE_EXTENSION } from '#cli/config/repository/files/classify.ts';

import {
    DOCKERIGNORE,
    EDGE_SLASHES,
    EXCLUDE_ALL_LINES,
    IGNORE_PATTERN_FORMS,
    DOCKERIGNORE_PATTERNS,
} from '#cli/config/checks/infrastructure/docker/dockerignore.ts';

function listMissingPatterns(required: string[], text: string): string[] {
    const lines = text.split('\n').map((line) => line.trim().replaceAll(EDGE_SLASHES, ''));
    const last = lines.findLastIndex((line) => EXCLUDE_ALL_LINES.has(line));
    const after = lines.slice(last + 1);
    return required.filter((pattern) => {
        if (IGNORE_PATTERN_FORMS.some(([prefix, suffix]) => lines.includes(`${prefix}${pattern}${suffix}`)))
            return false;
        if (last < 0) return true;
        if (!after.some((line) => line.startsWith('!'))) return false;
        return pattern.startsWith('**/') || after.includes(`!${pattern}`);
    });
}

/**
Reports each Dockerfile with no ignore file, or with one that misses a required pattern.

@param session the repository and its tools.
@param planned the scope files to read.
@returns the findings.
*/
export function checkDockerignore(session: Session, planned: PlannedCheck): Finding[] {
    const { contexts } = readComposeDocuments(session, planned);
    return planned.files
        .filter((file) => {
            const name = posix.basename(file.path);
            return (
                !name.endsWith(DOCKERIGNORE) &&
                (name === DOCKERFILE_NAME ||
                    name.startsWith(`${DOCKERFILE_NAME}.`) ||
                    name.endsWith(DOCKERFILE_EXTENSION))
            );
        })
        .flatMap(({ path: dockerfile }): Finding[] => {
            const folder = findScopeFolder(dockerfile, session.repository.scopeFolders);
            const scope = session.scopes.find((each) => each.folder.path === folder.path) as Scope;
            const required = [
                ...DOCKERIGNORE_PATTERNS,
                ...scope.configurations.flatMap((configuration) => configuration.ignored_paths),
            ];
            const paths = [
                ...new Set([
                    `${dockerfile}${DOCKERIGNORE}`,
                    ...(contexts.get(dockerfile) ?? []),
                    posix.join(posix.dirname(dockerfile), DOCKERIGNORE),
                ]),
            ];
            const ignore = paths
                .values()
                .map((path) => ({ path, text: findCachedText(session.reads, path) }))
                .find((file): file is typeof file & { text: string } => file.text !== undefined);
            if (ignore === undefined)
                return [
                    buildFinding(
                        planned,
                        { file: dockerfile, line: 1 },
                        'missing-file',
                        `Add an ignore file at ${paths.join(' or ')} that lists ${required.join(', ')}.`,
                    ),
                ];
            const missing = listMissingPatterns(required, ignore.text);
            return missing.length === 0
                ? []
                : [
                      buildFinding(
                          planned,
                          { file: ignore.path, line: 1 },
                          'missing-entry',
                          `Add these entries to ${ignore.path}: ${missing.join(', ')}.`,
                      ),
                  ];
        });
}
