import { posix } from 'node:path';
import { type Session } from '#cli/types/session.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { type CheckResult } from '#cli/types/runs/check.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { runCommandGroups } from '#cli/runs/command/check.ts';
import { FILE_PLACEHOLDER } from '#cli/config/placeholders.ts';
import { type TrackedFile } from '#cli/types/repository/files.ts';
import { listCheckFiles } from '#cli/repository/files/selection.ts';
import { buildPathMatcher } from '#cli/repository/files/matchers.ts';
import { DOCKERFILE_NAME } from '#cli/config/repository/files/classify.ts';
import { composeSchema } from '#cli/schemas/checks/infrastructure/docker/compose.ts';
import { DOCKERIGNORE } from '#cli/config/checks/infrastructure/docker/dockerignore.ts';

import {
    type ComposeFiles,
    type ComposeDocuments,
    type ComposeDeclaration,
} from '#cli/types/checks/infrastructure/docker.ts';
import {
    COMPOSE_CHECK,
    COMPOSE_SUFFIXES,
    COMPOSE_OVERRIDE,
    COMPOSE_FILE_FLAG,
} from '#cli/config/checks/infrastructure/docker/compose.ts';

// Group each base Compose file before its overrides so they read and validate in order.
function groupComposeFiles(files: TrackedFile[]): ComposeFiles[] {
    const groups = new Map<string, ComposeFiles>();
    for (const file of files) {
        const baseName = COMPOSE_OVERRIDE.exec(posix.basename(file.path))?.groups?.['base'];
        const base =
            baseName === undefined
                ? undefined
                : files.find(
                      ({ path }) =>
                          posix.dirname(path) === posix.dirname(file.path) &&
                          COMPOSE_SUFFIXES.map((suffix) => `${baseName}${suffix}`).includes(posix.basename(path)),
                  );
        const project = base ?? file;
        const group = groups.get(project.path) ?? { last: project, before: [] };
        if (file !== project) {
            group.before.push(group.last);
            group.last = file;
        }
        groups.set(project.path, group);
    }
    return [...groups.values()];
}

function listBuildContexts(declarations: ComposeDeclaration[], folder: string): [string, string[]][] {
    return Map.groupBy(declarations, ({ name }) => name)
        .values()
        .flatMap((service) => {
            const builds = service.flatMap(({ service: { build } }) => (build === undefined ? [] : [build]));
            if (builds.length === 0) return [];
            const declaredContexts = builds.flatMap(({ context }) =>
                context === undefined ? [] : [posix.join(folder, context)],
            );
            const contexts = declaredContexts.length === 0 ? [folder] : declaredContexts;
            const declaredNames = builds.flatMap(({ dockerfile }) => (dockerfile === undefined ? [] : [dockerfile]));
            const names = declaredNames.length === 0 ? [DOCKERFILE_NAME] : declaredNames;
            const ignores = contexts.map((context) => posix.join(context, DOCKERIGNORE));
            return contexts.flatMap((context) =>
                names.map((name): [string, string[]] => [posix.join(context, name), ignores]),
            );
        })
        .toArray();
}

/**
 * Reads Compose services and resolves their local build contexts.
 *
 * @param session the repository and its tools.
 * @param planned the scope files to read.
 * @returns the services and their build contexts.
 */
export function readComposeDocuments(session: Session, planned: PlannedCheck): ComposeDocuments {
    const documents: ComposeDocuments = { declarations: [], contexts: new Map() };
    for (const group of groupComposeFiles(listCheckFiles(planned, COMPOSE_CHECK))) {
        const declarations = [...group.before, group.last].flatMap(({ path }) => {
            const document = parseYamlFile(path, readCachedText(session.reads, path), composeSchema);
            const entries = document.services === undefined ? [] : Object.entries(document.services);
            return entries.map(([name, service]) => ({ name, path, service }));
        });
        documents.declarations.push(...declarations);
        const folder = posix.dirname(group.last.path);
        const buildContexts = listBuildContexts(declarations, folder);
        for (const [dockerfile, paths] of buildContexts)
            documents.contexts.set(dockerfile, [...(documents.contexts.get(dockerfile) ?? []), ...paths]);
    }
    return documents;
}

/**
 * Validates each Compose project with its overrides.
 *
 * @param session the repository and its tools.
 * @param planned the Compose check and its files.
 * @returns the check result.
 */
export async function checkDockerCompose(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const isCompose = buildPathMatcher(planned.check.files?.paths ?? []);
    const groups = groupComposeFiles(planned.files.filter(({ path }) => isCompose(path)));
    return runCommandGroups(
        session,
        planned,
        groups.map(({ last, before }) => {
            const command = (planned.check.command as string[]).flatMap((part) =>
                part === FILE_PLACEHOLDER
                    ? [
                          ...before.flatMap(({ path }) => [
                              posix.relative(planned.scope.folder.path, path),
                              COMPOSE_FILE_FLAG,
                          ]),
                          part,
                      ]
                    : [part],
            );
            return { files: [last], command };
        }),
    );
}
