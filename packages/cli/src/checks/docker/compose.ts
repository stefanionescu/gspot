import { z } from 'zod';
import { parse } from 'yaml';
import { posix } from 'node:path';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { runCommandGroups } from '#cli/runs/command/check.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { FILE_PLACEHOLDER } from '#cli/config/configurations.ts';
import { type TrackedFile } from '#cli/types/repository/inventory.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { type CheckInput, type CheckResult } from '#cli/types/runs/check.ts';
import { DOCKERIGNORE, DOCKERFILE_NAME } from '#cli/config/repository/inventory.ts';
import type { ComposeFiles, ComposeService, ComposeDocuments } from '#cli/types/checks/infrastructure.ts';

import {
    COMPOSE_CHECK,
    COMPOSE_OVERRIDE,
    COMPOSE_SUFFIXES,
    COMPOSE_FILE_FLAG,
} from '#cli/config/checks/infrastructure/docker.ts';

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

/**
 * Reads Compose services and resolves their local build contexts.
 * @param input the scope files to read.
 * @returns the services and their build contexts.
 */
function readComposeDocuments(input: CheckInput): ComposeDocuments {
    const patterns = input.manifests
        .values()
        .flatMap(({ checks }) => checks)
        .filter(({ name }) => name === COMPOSE_CHECK)
        .flatMap(({ files }) => files?.paths ?? [])
        .toArray();
    const isCompose = buildPathMatcher(patterns);
    const documents: ComposeDocuments = { declarations: [], contexts: new Map() };
    for (const group of groupComposeFiles(input.files.filter(({ path }) => isCompose(path)))) {
        const declarations = [...group.before, group.last].flatMap(({ path }) => {
            try {
                const document = composeSchema.parse(
                    parse(readCachedBytes(input.reads, path).toString('utf8'), { merge: true }),
                );
                const entries = document.services === undefined ? [] : Object.entries(document.services);
                return entries.map(([name, service]) => ({ name, path, service }));
            } catch (error) {
                throw new Error(`Cannot read Compose service images in ${path}.`, { cause: error });
            }
        });
        documents.declarations.push(...declarations);
        const folder = posix.dirname(group.last.path);
        const candidates = Map.groupBy(declarations, ({ name }) => name)
            .values()
            .flatMap((service) => {
                const builds = service.flatMap(({ service: { build } }) => (build === undefined ? [] : [build]));
                if (builds.length === 0) return [];
                const declaredContexts = builds.flatMap(({ context }) =>
                    context === undefined ? [] : [posix.join(folder, context)],
                );
                const contexts = declaredContexts.length === 0 ? [folder] : declaredContexts;
                const declaredNames = builds.flatMap(({ dockerfile }) =>
                    dockerfile === undefined ? [] : [dockerfile],
                );
                const names = declaredNames.length === 0 ? [DOCKERFILE_NAME] : declaredNames;
                const ignores = contexts.map((context) => posix.join(context, DOCKERIGNORE));
                return contexts.flatMap((context) =>
                    names.map((name) => [posix.join(context, name), ignores] as const),
                );
            });
        for (const [dockerfile, paths] of candidates)
            documents.contexts.set(dockerfile, [...(documents.contexts.get(dockerfile) ?? []), ...paths]);
    }
    return documents;
}

const composeSchema = z.object({
    services: z
        .record(
            z.string(),
            z.object({
                image: z.string().min(1).optional(),
                build: (
                    z.union([
                        z.string().transform((context) => ({ context, dockerfile: undefined })) satisfies z.ZodType<
                            NonNullable<ComposeService['build']>,
                            string
                        >,
                        z.object({
                            context: z.string().optional(),
                            dockerfile: z.string().optional(),
                        } satisfies SchemaShape<{ context?: string | undefined; dockerfile?: string | undefined }>),
                    ]) satisfies z.ZodType<
                        NonNullable<ComposeService['build']>,
                        string | NonNullable<ComposeService['build']>
                    >
                ).optional(),
            } satisfies SchemaShape<ComposeService>),
        )
        .optional(),
} satisfies SchemaShape<{ services?: Record<string, ComposeService> | undefined }>);

/**
 * Validates each Compose project with its overrides.
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
                              posix.relative(planned.selection.scope.path, path),
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

export { readComposeDocuments };
