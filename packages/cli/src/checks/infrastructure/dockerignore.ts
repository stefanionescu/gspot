import { posix } from 'node:path';
import { buildFinding } from '#cli/checks/finding.ts';
import { findScope } from '#cli/repository/scopes.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import { readComposeDocuments } from '#cli/checks/infrastructure/docker.ts';
import { type Finding, type CheckInput } from '#cli/types/checks/run/check.ts';
import { DOCKERIGNORE_ENTRIES } from '#cli/config/checks/infrastructure/docker.ts';

import {
    DOCKERIGNORE,
    EDGE_SLASHES,
    DOCKERFILE_NAME,
    IGNORE_PATTERN_FORMS,
    DOCKERFILE_EXTENSION,
} from '#cli/config/repository/inventory.ts';

/**
 * One finding for each Dockerfile with no ignore file, or with one that lets a required entry through.
 * @param input the Dockerfile paths, Compose contexts, and selected configuration exclusions.
 * @returns the findings.
 */
export function checkDockerignore(input: CheckInput): Finding[] {
    const { contexts } = readComposeDocuments(input);
    return input.files
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
            const scope = findScope(dockerfile, input.scopes);
            const selection = input.selections.find((entry) => entry.scope.path === scope.path) as ScopeSelection;
            const required = [
                ...DOCKERIGNORE_ENTRIES,
                ...selection.selected.flatMap((manifest) => manifest.ignored_folders),
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
                .flatMap((path) => {
                    const text = readCachedText(input.reads, path);
                    return text === undefined ? [] : [{ path, text }];
                })
                .next().value;
            if (ignore === undefined)
                return [
                    buildFinding(
                        input,
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
                          input,
                          { file: ignore.path, line: 1 },
                          'missing-entry',
                          `Add these entries to ${ignore.path}: ${missing.join(', ')}.`,
                      ),
                  ];
        });
}
