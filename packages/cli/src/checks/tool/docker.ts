import { parse } from 'yaml';
import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { readSource } from '#cli/platform/root/public.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { pathMatcher } from '#cli/repository/paths/public.ts';
import { runCheckTool } from '#cli/execution/command/public.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import type { ComposeProject } from '#cli/types/parsers/docker.ts';
import { toolOutputDetail } from '#cli/execution/command/contracts.ts';
import { CONFIGURATION_DIRECTORY } from '#cli/config/platform/locations.ts';
import { composeSchema, imageReportSchema } from '#cli/parsers/schema/docker.ts';
import { TRIVY_EXIT, DOCKERIGNORE_ENTRIES } from '#cli/config/checks/tool/docker.ts';

// Interpolated image names require Compose environment resolution and are not literal scan targets.
function composeImages(input: CheckInput, path: string): Set<string> {
    let document: ComposeProject;
    try {
        document = composeSchema.parse(
            parse(readSource(input.root, path, input.reads).toString('utf8'), { merge: true }),
        );
    } catch (error) {
        throw new Error(`Cannot read Compose service images in ${path}.`, { cause: error });
    }
    return new Set(
        (document.services === undefined ? [] : Object.values(document.services))
            .map((service) => service.image)
            .filter((image): image is string => image !== undefined && !image.includes('$')),
    );
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
            findingAt(input, { file: path, line: 1 }, secret.RuleID, `${image}: ${secret.RuleID}: ${secret.Title}`),
        ),
    ]);
    if ((result.code === TRIVY_EXIT) !== findings.length > 0)
        throw new Error(`Trivy returned an inconsistent image report for ${image}.`);
    return findings;
}

/**
 * One finding for each Dockerfile folder with no ignore file, or with one that lets a required entry through.
 * @param input the check input
 * @returns the findings
 */
export function dockerignore(input: CheckInput): Finding[] {
    const required = [
        ...DOCKERIGNORE_ENTRIES,
        ...input.selection.selected.flatMap((manifest) => manifest.dockerignore),
    ];
    const dockerfiles = input.files.filter((file) => {
        const name = posix.basename(file.path);
        return name === 'Dockerfile' || name.startsWith('Dockerfile.') || name.endsWith('.dockerfile');
    });
    const folders = new Map(dockerfiles.map((file) => [posix.dirname(file.path), file.path]));
    const findings = folders.entries().flatMap(([folder, dockerfile]): Finding[] => {
        const path = folder === '.' ? '.dockerignore' : `${folder}/.dockerignore`;
        if (statSync(join(input.root, path), { throwIfNoEntry: false }) === undefined)
            return [
                findingAt(
                    input,
                    { file: dockerfile, line: 1 },
                    'missing-file',
                    `Add a ${path} beside this Dockerfile that lists ${required.join(', ')}.`,
                ),
            ];
        const text = readSource(input.root, path, input.reads).toString('utf8');
        const lines = new Set(text.split('\n').map((line) => line.trim().replaceAll(/^\/|\/$/gu, '')));
        const missing = required.filter((entry) =>
            [entry, `**/${entry}`, `${entry}*`, `**/${entry}*`].every((form) => !lines.has(form)),
        );
        if (missing.length === 0) return [];
        return [
            findingAt(
                input,
                { file: path, line: 1 },
                'missing-entry',
                `Add these entries to ${path}: ${missing.join(', ')}.`,
            ),
        ];
    });
    return findings.toArray();
}

/**
 * Scan each literal service image once per Compose file.
 * @param input the check input
 * @returns the findings
 */
export async function trivyImage(input: CheckInput): Promise<Finding[]> {
    const isCompose = pathMatcher(
        input.manifests.get('docker')?.checks.find(({ name }) => name === 'docker/compose')?.files?.paths ?? [],
    );
    const findings: Finding[] = [];
    for (const file of input.files) {
        if (!isCompose(file.path)) continue;
        for (const image of composeImages(input, file.path))
            findings.push(...(await scanImage(input, image, file.path)));
    }
    return findings;
}
