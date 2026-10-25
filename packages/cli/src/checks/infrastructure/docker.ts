import { join, posix } from 'node:path';
import { type Session } from '#cli/types/session.ts';
import { buildFinding } from '#cli/checks/finding.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { findScopeFolder } from '#cli/repository/scopes.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { runCommandGroups } from '#cli/runs/command/check.ts';
import { FILE_PLACEHOLDER } from '#cli/config/placeholders.ts';
import { parseToolReport } from '#cli/parsers/formats/json.ts';
import { formatOutputTail } from '#cli/runs/command/output.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { type TrackedFile } from '#cli/types/repository/files.ts';
import { listCheckFiles } from '#cli/repository/files/selection.ts';
import { getConfigFilePath } from '#cli/runs/command/placeholders.ts';
import { type Finding, type CheckResult } from '#cli/types/runs/check.ts';
import { DOCKERFILE_NAME } from '#cli/config/repository/files/classify.ts';
import { readCachedText, findCachedText } from '#cli/system/files/reads.ts';
import { composeSchema, imageReportSchema } from '#cli/schemas/checks/infrastructure/docker.ts';

import {
    type ImageFinding,
    type ComposeFiles,
    type ComposeDocuments,
    type ComposeDeclaration,
} from '#cli/types/checks/infrastructure/docker.ts';
import {
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
} from '#cli/config/checks/infrastructure/docker.ts';

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
    const documents: ComposeDocuments = { declarations: [], contexts: new Map() };
    const groups = groupComposeFiles(listCheckFiles(planned, COMPOSE_CHECK));
    for (const group of groups) {
        const declarations = [...group.before, group.last].flatMap(({ path }) => {
            const document = parseYamlFile(path, readCachedText(session.reads, path), composeSchema);
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
@returns the check result.
*/
export async function checkDockerCompose(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const groups = groupComposeFiles(listCheckFiles(planned, COMPOSE_CHECK));
    return runCommandGroups(
        session,
        planned,
        groups.map(({ last, before }) => {
            const command = (planned.check.command as string[]).flatMap((argument) =>
                argument === FILE_PLACEHOLDER
                    ? [
                          ...before.flatMap(({ path }) => [
                              posix.relative(planned.scope.folder.path, path),
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
    const lines = text.split('\n').map((line) => line.trim().replaceAll(EDGE_SLASHES, ''));
    const last = lines.findLastIndex((line) => EXCLUDE_ALL_LINES.has(line));
    const after = lines.slice(last + 1);
    return required.filter((pattern) => {
        if (IGNORE_PATTERN_FORMS.some(([prefix, suffix]) => lines.includes(`${prefix}${pattern}${suffix}`)))
            return false;
        if (last === -1) return true;
        return (
            after.some((line) => line.startsWith('!')) && (pattern.startsWith('**/') || after.includes(`!${pattern}`))
        );
    });
}

/**
Reports each Dockerfile with no ignore file, or with one that misses a required pattern.

@param session the repository and its tools.
@param planned the scope files to read.
@returns the findings.
*/
export function checkDockerignore(session: Session, planned: PlannedCheck): Finding[] {
    const { contexts } = readComposeDocuments(session, planned);
    return planned.files
        .filter((file) => file.tags.includes('dockerfile') && !file.path.endsWith(DOCKERIGNORE))
        .flatMap(({ path: dockerfile }): Finding[] => {
            const folder = findScopeFolder(dockerfile, session.repository.scopeFolders);
            const scope = session.scopes.find((each) => each.folder.path === folder.path) as Scope;
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
                .map((path) => ({ path, text: findCachedText(session.reads, path) }))
                .find((file): file is typeof file & { text: string } => file.text !== undefined);
            if (ignore === undefined)
                return [
                    buildFinding(
                        planned,
                        { file: dockerfile, line: 1 },
                        'missing-file',
                        `Add an ignore file at ${paths.join(' or ')} that lists ${required.join(', ')}.`,
                    ),
                ];
            const missing = listMissingPatterns(required, ignore.text);
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

async function scanImage(session: Session, planned: PlannedCheck, image: string): Promise<ImageFinding[]> {
    const configFile = join(session.root, getConfigFilePath(session, planned, TRIVY_CONFIG_FILE));
    const result = await runCheckTool(session, planned, [...TRIVY_IMAGE_COMMAND, configFile, image], {
        cwd: session.root,
    });
    if (result.code !== 0 && result.code !== TRIVY_FINDINGS_EXIT_CODE) {
        const output = result.stderr.trim() === '' ? result : { stdout: '', stderr: result.stderr };
        const detail = formatOutputTail(output, `exit ${String(result.code)}`);
        throw new Error(`Trivy could not scan ${image}: ${detail}`);
    }
    const report = parseToolReport('Trivy', result.stdout, imageReportSchema);
    return (report.Results ?? []).flatMap((target) => [
        ...(target.Vulnerabilities ?? []).map((vulnerability) => ({
            rule: vulnerability.VulnerabilityID,
            message: `${image}: ${vulnerability.VulnerabilityID} (${vulnerability.PkgName})`,
        })),
        ...(target.Secrets ?? []).map((secret) => ({
            rule: 'secret',
            message: `${image}: ${secret.RuleID}: ${secret.Title}`,
        })),
    ]);
}

/**
Scans each literal service image once and reports its findings in every Compose file that names it.

@param session the repository and its tools.
@param planned the scope files to read.
@returns the findings.
*/
export async function checkDockerTrivyImage(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const scanned = new Map<string, ImageFinding[]>();
    const findings: Finding[] = [];
    const files = Map.groupBy(readComposeDocuments(session, planned).declarations, ({ path }) => path);
    for (const [path, services] of files) {
        const images = new Set(
            services
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
                ...report.map(({ rule, message }) => buildFinding(planned, { file: path, line: 1 }, rule, message)),
            );
        }
    }
    return findings;
}
