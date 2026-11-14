import { posix } from 'node:path';
import type { Session } from '#cli/types/tools.ts';
import { selectScope } from '#cli/repository/scopes.ts';
import { LEADING_DOT_SLASH } from '#cli/config/engine.ts';
import { buildPathMatcher } from '#cli/system/patterns.ts';
import { formatNameList } from '#cli/system/text/messages.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { findText, readText } from '#cli/system/files/reads.ts';
import { WHITESPACE_RUN, FOLDER_CONTENTS } from '#cli/config/system.ts';
import type { CheckCode, CheckFinding } from '#cli/types/engine/run.ts';
import type { DockerIgnoredSource } from '#cli/types/configurations/infrastructure.ts';
import { readComposeDocuments } from '#cli/configurations/infrastructure/docker/checks/compose.ts';
import { DOCKERIGNORE_EXPLANATIONS } from '#cli/configurations/infrastructure/docker/explanations.ts';
import { listDockerInstructions } from '#cli/configurations/infrastructure/docker/checks/instructions.ts';

import {
    DOCKER_RULES,
    DOCKERIGNORE,
    EDGE_SLASHES,
    COPY_FROM_FLAG,
    EXCLUDE_ALL_LINES,
    IGNORE_PATTERN_FORMS,
    DOCKERIGNORE_PATTERNS,
} from '#cli/config/configurations/docker.ts';

function isPatternExcluded(pattern: string, lines: Array<{ negated: boolean; glob: string }>): boolean {
    let isExcluded = false;
    let isBroad = false;
    for (const { negated, glob } of lines) {
        if (EXCLUDE_ALL_LINES.has(glob)) {
            isExcluded = !negated;
            isBroad = !negated;
        } else if (IGNORE_PATTERN_FORMS.some(([prefix, suffix]) => glob === `${prefix}${pattern}${suffix}`)) {
            isExcluded = !negated;
            isBroad = false;
        } else if (negated && isBroad && pattern.startsWith('**/')) isExcluded = false;
    }
    return isExcluded;
}

function isIgnoredPath(path: string, patterns: string[]): boolean {
    let isIgnored = false;
    for (const pattern of patterns) {
        const isNegated = pattern.startsWith('!');
        if (buildPathMatcher([isNegated ? pattern.slice(1) : pattern])(path)) isIgnored = !isNegated;
    }
    return isIgnored;
}

function listMissingPatterns(required: string[], text: string): string[] {
    const lines = text.split('\n').map((line) => {
        const value = line.trim().replaceAll(EDGE_SLASHES, '');
        const isNegated = value.startsWith('!');
        const spelling = isNegated ? value.slice(1) : value;
        return {
            negated: isNegated,
            glob: spelling.endsWith(FOLDER_CONTENTS) ? spelling.slice(0, -FOLDER_CONTENTS.length) : spelling,
        };
    });
    const patterns = required.map((pattern) =>
        pattern.endsWith(FOLDER_CONTENTS) ? pattern.slice(0, -FOLDER_CONTENTS.length) : pattern,
    );
    const absent = new Set(patterns.filter((pattern) => !isPatternExcluded(pattern, lines)));
    return required.filter((_, index) => absent.has(patterns[index] ?? ''));
}

function listIgnoredSources(text: string, ignoreText: string): DockerIgnoredSource[] {
    const patterns = ignoreText
        .split('\n')
        .map((line) => line.trim().replaceAll(EDGE_SLASHES, ''))
        .filter((line) => line !== '' && !line.startsWith('#'));

    return listDockerInstructions(text)
        .filter(({ name, text: body }) => name === 'COPY' && !body.includes(COPY_FROM_FLAG))
        .flatMap(({ text: body, line }) =>
            body
                .split(WHITESPACE_RUN)
                .filter((word) => !word.startsWith('--'))
                .slice(0, -1)
                .map((source) => source.replace(LEADING_DOT_SLASH, '').replaceAll(EDGE_SLASHES, ''))
                .filter((source) => source !== '.' && source !== '' && isIgnoredPath(source, patterns))
                .map((source) => ({ line, source })),
        );
}

function checkDockerignore(session: Session, planned: PlannedCheck): CheckFinding[] {
    const { contexts, findings } = readComposeDocuments(session, planned);
    return [
        ...findings,
        ...planned.files
            .filter((file) => file.tags.includes('dockerfile') && !file.path.endsWith(DOCKERIGNORE))
            .flatMap(({ path: dockerfile }): CheckFinding[] => {
                const scope = selectScope(dockerfile, session.scopes);
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
                    .map((path) => ({ path, text: findText(session.cache, path) }))
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
                    ...listIgnoredSources(readText(session.cache, dockerfile), ignore.text).map(({ line, source }) => ({
                        file: dockerfile,
                        line,
                        rule: DOCKER_RULES.ignoredSource,
                        message: `${ignore.path} excludes ${source}, so this COPY finds nothing.`,
                    })),
                ];
            }),
    ];
}

export const DOCKER_DOCKERIGNORE_CHECKS: Readonly<Record<string, CheckCode>> = {
    'docker/dockerignore': { check: checkDockerignore, explanations: DOCKERIGNORE_EXPLANATIONS },
};
