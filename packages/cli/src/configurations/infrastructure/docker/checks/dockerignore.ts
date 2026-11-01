import { posix } from 'node:path';
import { find } from '#cli/system/files/reads.ts';
import type { Session } from '#cli/types/tools.ts';
import type { Scope } from '#cli/types/settings.ts';
import { formatNameList } from '#cli/system/text.ts';
import { selectScopePath } from '#cli/repository/scopes.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { readComposeDocuments } from '#cli/configurations/infrastructure/docker/checks/compose.ts';

import {
    DOCKER_RULES,
    DOCKERIGNORE,
    EDGE_SLASHES,
    EXCLUDE_ALL_LINES,
    IGNORE_PATTERN_FORMS,
    DOCKERIGNORE_PATTERNS,
} from '#cli/config/configurations/infrastructure.ts';

function listMissingPatterns(required: string[], text: string): string[] {
    const lines = text.split('\n').map((line) => {
        const value = line.trim().replaceAll(EDGE_SLASHES, '');
        const negated = value.startsWith('!');
        const spelling = negated ? value.slice(1) : value;
        return { negated, entry: spelling.endsWith('/**') ? spelling.slice(0, -'/**'.length) : spelling };
    });
    const patterns = required.map((pattern) => (pattern.endsWith('/**') ? pattern.slice(0, -'/**'.length) : pattern));
    const absent = new Set(
        patterns.filter((pattern) => {
            let excluded = false;
            let broad = false;
            for (const { negated, entry } of lines) {
                if (EXCLUDE_ALL_LINES.has(entry)) {
                    excluded = !negated;
                    broad = !negated;
                } else if (IGNORE_PATTERN_FORMS.some(([prefix, suffix]) => entry === `${prefix}${pattern}${suffix}`)) {
                    excluded = !negated;
                    broad = false;
                } else if (negated && broad && pattern.startsWith('**/')) excluded = false;
            }
            return !excluded;
        }),
    );
    return required.filter((_, index) => absent.has(patterns[index] ?? ''));
}

/**
Reports each Dockerfile with no ignore file, or with one that misses a required pattern.

@param session the repository and its tools.
@param planned the scope files to read.
*/
export function checkDockerignore(session: Session, planned: PlannedCheck): CheckFinding[] {
    const { contexts, findings } = readComposeDocuments(session, planned);
    return [
        ...findings,
        ...planned.files
            .filter((file) => file.tags.includes('dockerfile') && !file.path.endsWith(DOCKERIGNORE))
            .flatMap(({ path: dockerfile }): CheckFinding[] => {
                const scopePath = selectScopePath(dockerfile, session.scopes);
                const scope = session.scopes.find((each) => each.path === scopePath) as Scope;
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
                    .map((path) => ({ path, text: find(session.cache, path) }))
                    .find((file): file is typeof file & { text: string } => file.text !== undefined);
                if (ignore === undefined)
                    return [
                        {
                            file: dockerfile,
                            line: 1,
                            rule: DOCKER_RULES.missingFile,
                            message: `Add an ignore file at ${formatNameList(paths, 'disjunction')} that lists ${required.join(', ')}.`,
                        },
                    ];
                const missing = listMissingPatterns(required, ignore.text);
                return missing.length === 0
                    ? []
                    : [
                          {
                              file: ignore.path,
                              line: 1,
                              rule: DOCKER_RULES.missingEntry,
                              message: `Add these entries to ${ignore.path}: ${missing.join(', ')}.`,
                          },
                      ];
            }),
    ];
}
