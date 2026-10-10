import { parse } from 'yaml';
import { join, posix } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { emptyResult } from '#cli/execution/report.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { pathMatcher } from '#cli/repository/paths/public.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { DOCKERFILE_NAME } from '#cli/config/parsers/docker.ts';
import { readText, readSource } from '#cli/platform/root/public.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { toolOutputDetail } from '#cli/execution/command/contracts.ts';
import { CONFIGURATION_DIRECTORY } from '#cli/config/platform/locations.ts';
import type { CheckInput, CheckResult } from '#cli/types/execution/check.ts';
import { runCheckTool, runCheckCommand } from '#cli/execution/command/public.ts';
import { composeSchema, imageReportSchema } from '#cli/parsers/schema/docker.ts';
import type { ComposeFiles, ComposeDocuments } from '#cli/types/checks/docker.ts';
import { TRIVY_EXIT, COMPOSE_OVERRIDE, DOCKERIGNORE_ENTRIES } from '#cli/config/checks/tool/docker.ts';

// Group actual project paths in native base-to-override order for metadata and validation.
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
                          [`${baseName}.yaml`, `${baseName}.yml`].includes(posix.basename(path)),
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
        .filter(({ name }) => name === 'docker/compose')
        .flatMap(({ files }) => files?.paths ?? [])
        .toArray();
    const isCompose = pathMatcher(patterns);
    const documents: ComposeDocuments = { declarations: [], contexts: new Map() };
    for (const group of composeGroups(input.files.filter(({ path }) => isCompose(path)))) {
        const declarations = [...group.before, group.last].flatMap(({ path }) => {
            try {
                const document = composeSchema.parse(
                    parse(readSource(input.root, path, input.reads).toString('utf8'), { merge: true }),
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
                const authoredContexts = builds.flatMap(({ context }) =>
                    context === undefined ? [] : [posix.join(folder, context)],
                );
                const contexts = authoredContexts.length === 0 ? [folder] : authoredContexts;
                const authoredNames = builds.flatMap(({ dockerfile }) =>
                    dockerfile === undefined ? [] : [dockerfile],
                );
                const names = authoredNames.length === 0 ? [DOCKERFILE_NAME] : authoredNames;
                const ignores = contexts.map((context) => posix.join(context, '.dockerignore'));
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
        [
            'trivy',
            'image',
            '--quiet',
            '--config',
            join(input.root, CONFIGURATION_DIRECTORY, input.scope, 'trivy.yml'),
            '--exit-code',
            String(TRIVY_EXIT),
            '--format',
            'json',
            '--scanners',
            'vuln,secret',
            image,
        ],
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

/**
 * One finding for each Dockerfile with no ignore file, or with one that lets a required entry through.
 * @param input the check input
 * @returns the findings
 */
export function dockerignore(input: CheckInput): Finding[] {
    const { contexts } = composeDocuments(input);
    const required = [
        ...DOCKERIGNORE_ENTRIES,
        ...input.selection.selected.flatMap((manifest) => manifest.dockerignore),
    ];
    return input.files
        .filter((file) => {
            const name = posix.basename(file.path);
            return (
                !name.endsWith('.dockerignore') &&
                (name === DOCKERFILE_NAME || name.startsWith(`${DOCKERFILE_NAME}.`) || name.endsWith('.dockerfile'))
            );
        })
        .flatMap(({ path: dockerfile }): Finding[] => {
            const paths = [
                ...new Set([
                    `${dockerfile}.dockerignore`,
                    ...(contexts.get(dockerfile) ?? []),
                    posix.join(posix.dirname(dockerfile), '.dockerignore'),
                ]),
            ];
            const ignore = paths
                .values()
                .flatMap((path) => {
                    const text = readText(input.root, path, input.reads);
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
            const lines = new Set(ignore.text.split('\n').map((line) => line.trim().replaceAll(/^\/|\/$/gu, '')));
            const missing = required.filter((entry) =>
                [entry, `**/${entry}`, `${entry}*`, `**/${entry}*`].every((form) => !lines.has(form)),
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
 * @param input the check input
 * @returns the findings
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
 * Validate each Compose project with its declared overrides through the shared native command runner.
 * @param session the open session
 * @param planned the planned Compose check
 * @returns the native findings and process outcome
 */
export async function compose(session: ToolSession, planned: PlannedCheck): Promise<CheckResult> {
    const isCompose = pathMatcher(planned.check.files?.paths ?? []);
    const groups = composeGroups(planned.files.filter(({ path }) => isCompose(path)));
    const report = emptyResult(planned);
    for (const { last, before } of groups) {
        const command = planned.check.command?.flatMap((part) =>
            part === '{file}'
                ? [...before.flatMap(({ path }) => [posix.relative(planned.scope.scope.path, path), '-f']), part]
                : [part],
        );
        const result = await runCheckCommand(
            session,
            { ...planned, files: [last] },
            command === undefined ? {} : { command },
        );
        if (!['passed', 'failed'].includes(result.status)) return result;
        Object.assign(report, result, {
            fileCount: report.fileCount,
            findings: [...report.findings, ...result.findings],
            duration: report.duration + result.duration,
            status: report.status === 'failed' ? report.status : result.status,
        });
    }
    return report;
}
