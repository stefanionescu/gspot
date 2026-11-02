import { posix } from 'node:path';
import type { Session } from '#cli/types/tools.ts';
import type { Scope } from '#cli/types/settings.ts';
import { formatNameList } from '#cli/system/text.ts';
import { WHITESPACE_RUN } from '#cli/config/parsers.ts';
import { find, read } from '#cli/system/files/reads.ts';
import { LEADING_DOT_SLASH } from '#cli/config/engine.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { selectScopePath } from '#cli/repository/scopes.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { DockerIgnoredSource } from '#cli/types/configurations/infrastructure.ts';
import { readComposeDocuments } from '#cli/configurations/infrastructure/docker/checks/compose.ts';
import { listDockerInstructions } from '#cli/configurations/infrastructure/docker/checks/instructions.ts';

import {
    DOCKER_RULES,
    DOCKERIGNORE,
    EDGE_SLASHES,
    COPY_FROM_FLAG,
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

function listIgnoredSources(text: string, ignoreText: string): DockerIgnoredSource[] {
    const patterns = ignoreText
        .split('\n')
        .map((line) => line.trim().replaceAll(EDGE_SLASHES, ''))
        .filter((line) => line !== '' && !line.startsWith('#'));
    const isIgnored = (path: string): boolean => {
        let ignored = false;
        for (const pattern of patterns) {
            const negated = pattern.startsWith('!');
            if (buildPathMatcher([negated ? pattern.slice(1) : pattern])(path)) ignored = !negated;
        }
        return ignored;
    };
    return listDockerInstructions(text)
        .filter(({ name, text: body }) => name === 'COPY' && !body.includes(COPY_FROM_FLAG))
        .flatMap(({ text: body, line }) =>
            body
                .split(WHITESPACE_RUN)
                .filter((word) => !word.startsWith('--'))
                .slice(0, -1)
                .map((source) => source.replace(LEADING_DOT_SLASH, '').replaceAll(EDGE_SLASHES, ''))
                .filter((source) => source !== '.' && source !== '' && isIgnored(source))
                .map((source) => ({ line, source })),
        );
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
                return [
                    ...(missing.length === 0
                        ? []
                        : [
                              {
                                  file: ignore.path,
                                  line: 1,
                                  rule: DOCKER_RULES.missingEntry,
                                  message: `Add these entries to ${ignore.path}: ${missing.join(', ')}.`,
                              },
                          ]),
                    ...listIgnoredSources(read(session.cache, dockerfile), ignore.text).map(({ line, source }) => ({
                        file: dockerfile,
                        line,
                        rule: DOCKER_RULES.ignoredSource,
                        message: `${ignore.path} excludes ${source}, so this COPY finds nothing.`,
                    })),
                ];
            }),
    ];
}
