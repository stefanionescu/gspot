import { posix } from 'node:path';
import { buildFinding } from '#cli/runs/finding.ts';
import { findScope } from '#cli/repository/scopes.ts';
import { type Finding } from '#cli/types/runs/check.ts';
import { findCachedText } from '#cli/system/files/reads.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import { readComposeDocuments } from '#cli/checks/docker/compose.ts';
import { DOCKERFILE_NAME, DOCKERFILE_EXTENSION } from '#cli/config/repository/inventory.ts';
import { DOCKERIGNORE, EDGE_SLASHES, DOCKERIGNORE_ENTRIES, IGNORE_PATTERN_FORMS } from '#cli/config/checks/docker.ts';

/**
 * Reports each Dockerfile with no ignore file, or with one that misses a required pattern.
 *
 * @param session the repository and its tools.
 * @param planned the scope files to read.
 * @returns the findings.
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
            const scope = findScope(dockerfile, session.repository.scopes);
            const selection = session.scopes.find((entry) => entry.scope.path === scope.path) as ScopeSelection;
            const required = [
                ...DOCKERIGNORE_ENTRIES,
                ...selection.selected.flatMap((manifest) => manifest.ignored_paths),
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
                .find((entry): entry is typeof entry & { text: string } => entry.text !== undefined);
            if (ignore === undefined)
                return [
                    buildFinding(
                        planned,
                        { file: dockerfile, line: 1 },
                        'missing-file',
                        `Add an ignore file at ${paths.join(' or ')} that lists ${required.join(', ')}.`,
                    ),
                ];
            const lines = new Set(ignore.text.split('\n').map((line) => line.trim().replaceAll(EDGE_SLASHES, '')));
            const missing = required.filter((entry) =>
                IGNORE_PATTERN_FORMS.every(([prefix, suffix]) => !lines.has(`${prefix}${entry}${suffix}`)),
            );
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
