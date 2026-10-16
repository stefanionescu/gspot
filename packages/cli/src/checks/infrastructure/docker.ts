import { z } from 'zod';
import { parse } from 'yaml';
import { join, posix } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { scopeOf } from '#cli/repository/scopes.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import { runCheckTool } from '#cli/execution/command/tool.ts';
import { runCommandGroups } from '#cli/execution/command/check.ts';
import { toolOutputDetail } from '#cli/execution/command/output.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import { TOOL_FILE_DIRECTORY } from '#cli/config/system/locations.ts';
import { type TrackedFile } from '#cli/types/repository/inventory.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { readCachedText, readCachedBytes } from '#cli/system/files/reads.ts';
import { type Finding, type CheckInput, type CheckResult } from '#cli/types/execution/check.ts';
import type { ComposeFiles, ComposeService, ComposeDocuments } from '#cli/types/checks/infrastructure.ts';

import {
    DOCKERIGNORE,
    EDGE_SLASHES,
    DOCKERFILE_NAME,
    IGNORE_ENTRY_FORMS,
    DOCKERFILE_EXTENSION,
} from '#cli/config/repository/inventory.ts';
import {
    TRIVY_YML,
    TRIVY_EXIT,
    COMPOSE_CHECK,
    COMPOSE_OVERRIDE,
    COMPOSE_SUFFIXES,
    COMPOSE_FILE_FLAG,
    TRIVY_IMAGE_COMMAND,
    DOCKERIGNORE_ENTRIES,
    TRIVY_SCHEMA_VERSION,
} from '#cli/config/checks/infrastructure/docker.ts';

// Group actual project paths in the order of base files before their overrides for metadata and validation.
function composeGroups(files: TrackedFile[]): ComposeFiles[] {
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
// Compose declares paths. Native YAML owns service, image, and build metadata.
function composeDocuments(input: CheckInput): ComposeDocuments {
    const patterns = input.manifests
        .values()
        .flatMap(({ checks }) => checks)
        .filter(({ name }) => name === COMPOSE_CHECK)
        .flatMap(({ files }) => files?.paths ?? [])
        .toArray();
    const isCompose = pathMatcher(patterns);
    const documents: ComposeDocuments = { declarations: [], contexts: new Map() };
    for (const group of composeGroups(input.files.filter(({ path }) => isCompose(path)))) {
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
// Native exit status and parsed findings must agree before a scan can count as clean.
async function scanImage(input: CheckInput, image: string, path: string): Promise<Finding[]> {
    const result = await runCheckTool(
        input,
        [...TRIVY_IMAGE_COMMAND, join(input.root, TOOL_FILE_DIRECTORY, input.selection.scope.path, TRIVY_YML), image],
        { cwd: input.root },
    );
    if (result.code !== 0 && result.code !== TRIVY_EXIT) {
        const detail = toolOutputDetail(result, `exit ${String(result.code)}`);
        throw new Error(`Trivy could not scan ${image}: ${detail}`);
    }
    const report = imageReportSchema.parse(JSON.parse(result.stdout));
    const findings = (report.Results ?? []).flatMap((entry) => [
        ...(entry.Vulnerabilities ?? []).map((vulnerability) =>
            findingAt(
                input,
                { file: path, line: 1 },
                vulnerability.VulnerabilityID,
                `${image}: ${vulnerability.VulnerabilityID} (${vulnerability.PkgName})`,
            ),
        ),
        ...(entry.Secrets ?? []).map((secret) =>
            findingAt(input, { file: path, line: 1 }, 'secret', `${image}: ${secret.RuleID}: ${secret.Title}`),
        ),
    ]);
    if ((result.code === TRIVY_EXIT) !== findings.length > 0)
        throw new Error(`Trivy returned an inconsistent image report for ${image}.`);
    return findings;
}
const imageReportSchema = z.object({
    SchemaVersion: z.literal(TRIVY_SCHEMA_VERSION),
    ArtifactName: z.string().min(1),
    Results: z
        .array(
            z.object({
                Target: z.string().min(1),
                Vulnerabilities: z
                    .array(
                        z.object({
                            VulnerabilityID: z.string().min(1),
                            PkgName: z.string().min(1),
                        } satisfies SchemaShape<{ VulnerabilityID: string; PkgName: string }>),
                    )
                    .optional(),
                Secrets: z
                    .array(
                        z.object({ RuleID: z.string().min(1), Title: z.string().min(1) } satisfies SchemaShape<{
                            RuleID: string;
                            Title: string;
                        }>),
                    )
                    .optional(),
            } satisfies SchemaShape<{
                Target: string;
                Vulnerabilities?: { VulnerabilityID: string; PkgName: string }[] | undefined;
                Secrets?: { RuleID: string; Title: string }[] | undefined;
            }>),
        )
        .optional(),
} satisfies SchemaShape<{
    SchemaVersion: typeof TRIVY_SCHEMA_VERSION;
    ArtifactName: string;
    Results?:
        | {
              Target: string;
              Vulnerabilities?: { VulnerabilityID: string; PkgName: string }[] | undefined;
              Secrets?: { RuleID: string; Title: string }[] | undefined;
          }[]
        | undefined;
}>);
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
 * One finding for each Dockerfile with no ignore file, or with one that lets a required entry through.
 * @param input the check input.
 * @returns the findings.
 */
export function dockerignore(input: CheckInput): Finding[] {
    const { contexts } = composeDocuments(input);
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
            const scope = scopeOf(dockerfile, input.scopeEntries);
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
                    findingAt(
                        input,
                        { file: dockerfile, line: 1 },
                        'missing-file',
                        `Add an ignore file at ${paths.join(' or ')} that lists ${required.join(', ')}.`,
                    ),
                ];
            const lines = new Set(ignore.text.split('\n').map((line) => line.trim().replaceAll(EDGE_SLASHES, '')));
            const missing = required.filter((entry) =>
                IGNORE_ENTRY_FORMS.every(([prefix, suffix]) => !lines.has(`${prefix}${entry}${suffix}`)),
            );
            return missing.length === 0
                ? []
                : [
                      findingAt(
                          input,
                          { file: ignore.path, line: 1 },
                          'missing-entry',
                          `Add these entries to ${ignore.path}: ${missing.join(', ')}.`,
                      ),
                  ];
        });
}
/**
 * Scan each literal service image once and attribute its findings to every declaring Compose file.
 * @param input the check input.
 * @returns the findings.
 */
export async function trivyImage(input: CheckInput): Promise<Finding[]> {
    const scanned = new Map<string, Finding[]>();
    const findings: Finding[] = [];
    const files = Map.groupBy(composeDocuments(input).declarations, ({ path }) => path);
    for (const [path, services] of files) {
        const images = new Set(
            services
                .map(({ service: { image } }) => image)
                .filter((image): image is string => image !== undefined && !image.includes('$')),
        );
        for (const image of images) {
            let report = scanned.get(image);
            if (report === undefined) {
                report = await scanImage(input, image, path);
                scanned.set(image, report);
            }
            findings.push(...report.map((finding) => ({ ...finding, file: path })));
        }
    }
    return findings;
}
/**
 * Validate each Compose project with its declared overrides through the shared command runner.
 * @param session the open session.
 * @param planned the planned Compose check.
 * @returns the findings and process outcome.
 */
export async function dockerCompose(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const isCompose = pathMatcher(planned.check.files?.paths ?? []);
    const groups = composeGroups(planned.files.filter(({ path }) => isCompose(path)));
    return runCommandGroups(
        session,
        planned,
        groups.map(({ last, before }) => {
            const command = (planned.check.command as string[]).flatMap((part) =>
                part === '{file}'
                    ? [
                          ...before.flatMap(({ path }) => [
                              posix.relative(planned.scope.scope.path, path),
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
