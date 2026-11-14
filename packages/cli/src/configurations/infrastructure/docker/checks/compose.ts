import { posix } from 'node:path';
import type { Session } from '#cli/types/tools.ts';
import { readText } from '#cli/system/files/reads.ts';
import { FILE_PLACEHOLDER } from '#cli/config/engine.ts';
import { listCheckFiles } from '#cli/engine/plan/files.ts';
import type { TrackedFile } from '#cli/types/repository.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { composeSchema } from '#cli/schemas/configurations.ts';
import { assertCommandCheck } from '#cli/engine/plan/checks.ts';
import { parseCheckedFile } from '#cli/configurations/syntax.ts';
import { DOCKERFILE_NAME } from '#cli/config/repository/files.ts';
import { YAML_EXTENSIONS } from '#cli/config/repository/setup.ts';
import { runCommandBatches } from '#cli/engine/run/tool-runs/check.ts';
import type { CheckCode, CheckResult, CheckSession } from '#cli/types/engine/run.ts';
import type { ComposeFiles, ComposeDocuments, ComposeDeclaration } from '#cli/types/configurations/infrastructure.ts';
import { DOCKERIGNORE, COMPOSE_CHECK, COMPOSE_OVERRIDE, COMPOSE_FILE_FLAG } from '#cli/config/configurations/docker.ts';

function listComposeFiles(files: TrackedFile[]): ComposeFiles[] {
    const groups = new Map<string, ComposeFiles>();
    for (const file of files) {
        const baseName = COMPOSE_OVERRIDE.exec(posix.basename(file.path))?.groups?.['base'];
        const base =
            baseName === undefined
                ? undefined
                : files.find(
                      ({ path }) =>
                          posix.dirname(path) === posix.dirname(file.path) &&
                          YAML_EXTENSIONS.map((suffix) => `${baseName}${suffix}`).includes(posix.basename(path)),
                  );
        const project = base ?? file;
        const group = groups.get(project.path) ?? { last: project, before: [] };
        if (file !== project) {
            group.before.push(group.last);
            group.last = file;
        }
        groups.set(project.path, group);
    }
    return groups.values().toArray();
}

function listBuildContexts(declarations: ComposeDeclaration[], folder: string): Array<[string, string[]]> {
    return Map.groupBy(declarations, ({ name }) => name)
        .values()
        .flatMap((service) => {
            const builds = service.flatMap(({ service: { build } }) => (build === undefined ? [] : [build]));
            if (builds.length === 0) return [];
            const buildContexts = builds.flatMap(({ context }) =>
                context === undefined ? [] : [posix.join(folder, context)],
            );
            const contexts = buildContexts.length === 0 ? [folder] : buildContexts;
            const dockerfileNames = builds.flatMap(({ dockerfile }) => (dockerfile === undefined ? [] : [dockerfile]));
            const names = dockerfileNames.length === 0 ? [DOCKERFILE_NAME] : dockerfileNames;
            const ignores = contexts.map((context) => posix.join(context, DOCKERIGNORE));
            return contexts.flatMap((context) =>
                names.map((name): [string, string[]] => [posix.join(context, name), ignores]),
            );
        })
        .toArray();
}

async function checkCompose(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    assertCommandCheck(planned);
    const groups = listComposeFiles(listCheckFiles(planned, COMPOSE_CHECK));
    return runCommandBatches(
        session,
        planned,
        groups.map(({ last, before }) => {
            const command = planned.check.command.flatMap((argument) =>
                argument === FILE_PLACEHOLDER
                    ? [
                          ...before.flatMap(({ path }) => [
                              posix.relative(planned.scope.path, path),
                              COMPOSE_FILE_FLAG,
                          ]),
                          argument,
                      ]
                    : [argument],
            );
            return { files: [last], command };
        }),
    );
}

export function readComposeDocuments(session: Session, planned: PlannedCheck): ComposeDocuments {
    const documents: ComposeDocuments = { declarations: [], contexts: new Map(), findings: [] };
    const groups = listComposeFiles(listCheckFiles(planned, COMPOSE_CHECK));
    for (const group of groups) {
        const declarations = [...group.before, group.last].flatMap(({ path }) => {
            const parsed = parseCheckedFile(path, () =>
                parseYamlFile(path, readText(session.cache, path), composeSchema),
            );
            if ('error' in parsed) {
                documents.findings.push(parsed.error);
                return [];
            }
            const document = parsed.value;
            const servicePairs = document.services === undefined ? [] : Object.entries(document.services);
            return servicePairs.map(([name, service]) => ({ name, path, service }));
        });
        documents.declarations.push(...declarations);
        const folder = posix.dirname(group.last.path);
        const buildContexts = listBuildContexts(declarations, folder);
        for (const [dockerfile, paths] of buildContexts)
            documents.contexts.set(dockerfile, [...(documents.contexts.get(dockerfile) ?? []), ...paths]);
    }
    return documents;
}

export const DOCKER_COMPOSE_CHECKS: Readonly<Record<string, CheckCode>> = {
    'docker/compose': { run: checkCompose },
};
