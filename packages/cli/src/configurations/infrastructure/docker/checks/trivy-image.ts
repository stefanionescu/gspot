import { join } from 'node:path';

import {
    DOCKER_RULES,
    TRIVY_CONFIG_FILE,
    TRIVY_FINDINGS_EXIT_CODE,
    TRIVY_IMAGE_COMMAND,
} from '#cli/config/configurations/infrastructure.ts';
import { readComposeDocuments } from '#cli/configurations/infrastructure/docker/checks/compose.ts';
import { formatOutputTail } from '#cli/engine/tool-runs/output.ts';
import { getConfigPath } from '#cli/engine/tool-runs/placeholders.ts';
import { runCheckTool } from '#cli/engine/tool-runs/tool.ts';
import { parseToolOutput } from '#cli/parsers/formats/json.ts';
import { trivyImageOutputSchema } from '#cli/schemas/configurations.ts';
import { CheckStop } from '#cli/system/errors.ts';
import type { ImageFinding } from '#cli/types/configurations/infrastructure.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { type CheckCode, type CheckSession } from '#cli/types/engine/run.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';

async function scanImage(session: CheckSession, planned: PlannedCheck, image: string): Promise<ImageFinding[]> {
    const config = join(session.root, getConfigPath(session, planned, TRIVY_CONFIG_FILE));
    const result = await runCheckTool(session, planned, [...TRIVY_IMAGE_COMMAND, config, image], {
        cwd: session.root,
    });
    if (result.code !== 0 && result.code !== TRIVY_FINDINGS_EXIT_CODE) {
        const output = result.stderr.trim() === '' ? result : { stdout: '', stderr: result.stderr };
        const detail = formatOutputTail(output, `exit ${String(result.code)}`);
        throw new CheckStop('error', `Trivy could not scan ${image}: ${detail}`);
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
async function checkTrivyImage(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
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

export const DOCKER_TRIVY_IMAGE_CHECKS: Readonly<Record<string, CheckCode>> = {
    'docker/trivy-image': { check: checkTrivyImage },
};
