import { join } from 'node:path';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import { parseToolReport } from '#cli/parsers/json.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { formatOutputTail } from '#cli/runs/command/output.ts';
import type { ImageFinding } from '#cli/types/checks/docker.ts';
import { getConfigFile } from '#cli/runs/command/placeholders.ts';
import { readComposeDocuments } from '#cli/checks/docker/compose.ts';
import { getConfigFiles } from '#cli/generation/config-files/generate.ts';
import { getConfigFileTarget } from '#cli/generation/config-files/needed.ts';
import { imageReportSchema } from '#cli/schemas/checks/docker/trivy-image.ts';
import { TRIVY_CONFIG_FILE, TRIVY_IMAGE_COMMAND, TRIVY_FINDINGS_EXIT_CODE } from '#cli/config/checks/docker.ts';

// The tool's exit status and parsed findings must agree before a scan can count as clean.
async function scanImage(session: Session, planned: PlannedCheck, image: string): Promise<ImageFinding[]> {
    const result = await runCheckTool(
        session,
        planned,
        [
            ...TRIVY_IMAGE_COMMAND,
            join(
                session.root,
                getConfigFileTarget(
                    planned.scope.folder.path,
                    getConfigFile(session, planned, TRIVY_CONFIG_FILE),
                    getConfigFiles(session).targets,
                ),
            ),
            image,
        ],
        { cwd: session.root },
    );
    if (result.code !== 0 && result.code !== TRIVY_FINDINGS_EXIT_CODE) {
        const detail = formatOutputTail(result, `exit ${String(result.code)}`);
        throw new Error(`Trivy could not scan ${image}: ${detail}`);
    }
    const report = parseToolReport('Trivy', result.stdout, imageReportSchema);
    const findings = (report.Results ?? []).flatMap((entry) => [
        ...(entry.Vulnerabilities ?? []).map((vulnerability) => ({
            rule: vulnerability.VulnerabilityID,
            message: `${image}: ${vulnerability.VulnerabilityID} (${vulnerability.PkgName})`,
        })),
        ...(entry.Secrets ?? []).map((secret) => ({
            rule: 'secret',
            message: `${image}: ${secret.RuleID}: ${secret.Title}`,
        })),
    ]);
    if ((result.code === TRIVY_FINDINGS_EXIT_CODE) !== findings.length > 0)
        throw new Error(`Trivy returned an inconsistent image report for ${image}.`);
    return findings;
}

/**
 * Scans each literal service image once and reports its findings in every Compose file that names it.
 *
 * @param session the repository and its tools.
 * @param planned the scope files to read.
 * @returns the findings.
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
