import { join, posix } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { read, find } from '#cli/system/files/reads.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { selectScopePath } from '#cli/repository/scopes.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { FILE_PLACEHOLDER } from '#cli/config/placeholders.ts';
import { parseToolOutput } from '#cli/parsers/formats/json.ts';
import { runCommandBatches } from '#cli/runs/command/check.ts';
import { formatOutputTail } from '#cli/runs/command/output.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { DOCKERFILE_NAME } from '#cli/config/repository/files.ts';
import { type TrackedFile } from '#cli/types/repository/files.ts';
import type { Session, CheckSession } from '#cli/types/session.ts';
import { listCheckFiles } from '#cli/repository/files/selection.ts';
import { getConfigFilePath } from '#cli/runs/command/placeholders.ts';
import { parseCheckedFile } from '#cli/checks/cross-configuration/syntax.ts';
import { type CheckResult, type CheckFinding } from '#cli/types/runs/check.ts';
import { composeSchema, trivyImageOutputSchema } from '#cli/schemas/checks/infrastructure.ts';

import {
    type ImageFinding,
    type ComposeFiles,
    type ComposeDocuments,
    type ComposeDeclaration,
} from '#cli/types/checks/infrastructure.ts';
import {
    DOCKER_RULES,
    DOCKERIGNORE,
    EDGE_SLASHES,
    COMPOSE_CHECK,
    COMPOSE_SUFFIXES,
    COMPOSE_OVERRIDE,
    TRIVY_CONFIG_FILE,
    COMPOSE_FILE_FLAG,
    EXCLUDE_ALL_LINES,
    TRIVY_IMAGE_COMMAND,
    IGNORE_PATTERN_FORMS,
    DOCKERIGNORE_PATTERNS,
    TRIVY_FINDINGS_EXIT_CODE,
} from '#cli/config/checks/infrastructure.ts';

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
    return groups.values().toArray();
}

function listBuildContexts(declarations: ComposeDeclaration[], folder: string): [string, string[]][] {
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

function readComposeDocuments(session: Session, planned: PlannedCheck): ComposeDocuments {
    const documents: ComposeDocuments = { declarations: [], contexts: new Map(), findings: [] };
    const groups = listComposeFiles(listCheckFiles(planned, COMPOSE_CHECK));
    for (const group of groups) {
        const declarations = [...group.before, group.last].flatMap(({ path }) => {
            const parsed = parseCheckedFile(path, () => parseYamlFile(path, read(session.cache, path), composeSchema));
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

/**
Validates each Compose project with its overrides.

@param session the repository and its tools.
@param planned the Compose check and its files.
*/
export async function checkCompose(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    const groups = listComposeFiles(listCheckFiles(planned, COMPOSE_CHECK));
    return runCommandBatches(
        session,
        planned,
        groups.map(({ last, before }) => {
            const command = (planned.check.command as string[]).flatMap((argument) =>
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
                            message: `Add an ignore file at ${paths.join(' or ')} that lists ${required.join(', ')}.`,
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

async function scanImage(session: CheckSession, planned: PlannedCheck, image: string): Promise<ImageFinding[]> {
    const configFile = join(session.root, getConfigFilePath(session, planned, TRIVY_CONFIG_FILE));
    const result = await runCheckTool(session, planned, [...TRIVY_IMAGE_COMMAND, configFile, image], {
        cwd: session.root,
    });
    if (result.code !== 0 && result.code !== TRIVY_FINDINGS_EXIT_CODE) {
        const output = result.stderr.trim() === '' ? result : { stdout: '', stderr: result.stderr };
        const detail = formatOutputTail(output, `exit ${String(result.code)}`);
        throw new GspotError('check', `Trivy could not scan ${image}: ${detail}`);
    }
    const report = parseToolOutput('Trivy', result.stdout, trivyImageOutputSchema);
    return (report.Results ?? []).flatMap((target) => [
        ...(target.Vulnerabilities ?? []).map((vulnerability) => ({
            rule: vulnerability.VulnerabilityID,
            message: `${image}: ${vulnerability.VulnerabilityID} (${vulnerability.PkgName})`,
        })),
        ...(target.Secrets ?? []).map((secret) => ({
            rule: DOCKER_RULES.secret,
            message: `${image}: ${secret.RuleID}: ${secret.Title}`,
        })),
    ]);
}

/**
Scans each literal service image once and reports its findings in every Compose file that names it.

@param session the repository and its tools.
@param planned the scope files to read.
*/
export async function checkTrivyImage(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const scanned = new Map<string, ImageFinding[]>();
    const documents = readComposeDocuments(session, planned);
    const findings = [...documents.findings];
    const files = Map.groupBy(documents.declarations, ({ path }) => path);
    for (const [path, services] of files) {
        const images = new Set(
            services
                .filter(({ service }) => service.build === undefined)
                .map(({ service: { image } }) => image)
                .filter((image): image is string => image !== undefined && !image.includes('$')),
        );
        for (const image of images) {
            let report = scanned.get(image);
            if (report === undefined) {
                report = await scanImage(session, planned, image);
                scanned.set(image, report);
            }
            findings.push(
                ...report.map(({ rule, message }) => ({
                    file: path,
                    line: 1,
                    rule: rule,
                    message: message,
                })),
            );
        }
    }
    return findings;
}
