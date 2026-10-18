import { z } from 'zod';
import { join } from 'node:path';
import { buildFinding } from '#cli/runs/finding.ts';
import { parseReport } from '#cli/runs/output/json.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { formatOutputTail } from '#cli/runs/command/output.ts';
import { TOOL_FILES_FOLDER } from '#cli/config/system/locations.ts';
import { readComposeDocuments } from '#cli/checks/docker/compose.ts';
import { type Finding, type CheckInput } from '#cli/types/runs/check.ts';

import {
    TRIVY_YML,
    TRIVY_EXIT,
    TRIVY_IMAGE_COMMAND,
    TRIVY_SCHEMA_VERSION,
} from '#cli/config/checks/infrastructure/docker.ts';

// The tool's exit status and parsed findings must agree before a scan can count as clean.
async function scanImage(input: CheckInput, image: string, path: string): Promise<Finding[]> {
    const result = await runCheckTool(
        input,
        [...TRIVY_IMAGE_COMMAND, join(input.root, TOOL_FILES_FOLDER, input.selection.scope.path, TRIVY_YML), image],
        { cwd: input.root },
    );
    if (result.code !== 0 && result.code !== TRIVY_EXIT) {
        const detail = formatOutputTail(result, `exit ${String(result.code)}`);
        throw new Error(`Trivy could not scan ${image}: ${detail}`);
    }
    const report = parseReport('Trivy', result.stdout, imageReportSchema);
    const findings = (report.Results ?? []).flatMap((entry) => [
        ...(entry.Vulnerabilities ?? []).map((vulnerability) =>
            buildFinding(
                input,
                { file: path, line: 1 },
                vulnerability.VulnerabilityID,
                `${image}: ${vulnerability.VulnerabilityID} (${vulnerability.PkgName})`,
            ),
        ),
        ...(entry.Secrets ?? []).map((secret) =>
            buildFinding(input, { file: path, line: 1 }, 'secret', `${image}: ${secret.RuleID}: ${secret.Title}`),
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

/**
 * Scans each literal service image once and reports its findings in every Compose file that names it.
 * @param input the scope files to read.
 * @returns the findings.
 */
export async function checkDockerTrivyImage(input: CheckInput): Promise<Finding[]> {
    const scanned = new Map<string, Finding[]>();
    const findings: Finding[] = [];
    const files = Map.groupBy(readComposeDocuments(input).declarations, ({ path }) => path);
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
