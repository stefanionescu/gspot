import { z } from 'zod';
import { parse } from 'yaml';
import { join } from 'node:path';
import { scopeFile } from '#cli/kits/targets.ts';
import { findingAt } from '#cli/checks/result.ts';
import { scopeOf } from '#cli/repository/scopes.ts';
import { readSource } from '#cli/repository/sources.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import { runCheckCommand } from '#cli/execution/tool/runner.ts';
import type { Finding, EngineInput } from '#cli/types/checks.ts';
import { toolOutputDetail } from '#cli/execution/tool/findings.ts';
import { COMPOSE_FILES, FINDINGS_EXIT, SHOWN_FINDINGS } from '#cli/config/checks/platforms.ts';

// The Trivy JSON report version this reader understands.
const TRIVY_SCHEMA_VERSION = 2;

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
                        }),
                    )
                    .optional(),
                Secrets: z.array(z.object({ RuleID: z.string().min(1), Title: z.string().min(1) })).optional(),
            }),
        )
        .optional(),
});
const composeSchema = z.object({
    services: z.record(z.string(), z.object({ image: z.string().min(1).optional() })).optional(),
});

// Interpolated image names require Compose environment resolution and are not literal scan targets.
function composeImages(input: EngineInput, path: string): Set<string> {
    let document: z.infer<typeof composeSchema>;
    try {
        document = composeSchema.parse(
            parse(readSource(input.root, path, input.reads).toString('utf8'), { merge: true }),
        );
    } catch (error) {
        throw new Error(`Cannot read Compose service images in ${path}.`, { cause: error });
    }
    return new Set(
        Object.values(document.services ?? {})
            .map((service) => service.image)
            .filter((image): image is string => image !== undefined && !image.includes('$')),
    );
}

// Native exit status and parsed findings must agree before a scan can count as clean.
async function scanImage(input: EngineInput, image: string): Promise<string[]> {
    const result = await runCheckCommand(
        input,
        [
            'trivy',
            'image',
            '--quiet',
            '--config',
            join(input.root, scopeFile(input.scope, 'trivy.yaml')),
            '--exit-code',
            String(FINDINGS_EXIT),
            '--format',
            'json',
            '--scanners',
            'vuln,secret',
            image,
        ],
        { cwd: input.root },
    );
    if (result.code !== 0 && result.code !== FINDINGS_EXIT) {
        const detail = toolOutputDetail(result, `exit ${String(result.code)}`);
        throw new Error(`Trivy could not scan ${image}: ${detail}`);
    }
    const report = imageReportSchema.parse(JSON.parse(result.stdout));
    const messages = (report.Results ?? []).flatMap((entry) => [
        ...(entry.Vulnerabilities ?? []).map(
            (vulnerability) => `${vulnerability.VulnerabilityID} (${vulnerability.PkgName})`,
        ),
        ...(entry.Secrets ?? []).map((secret) => `${secret.RuleID}: ${secret.Title}`),
    ]);
    if ((result.code === FINDINGS_EXIT) !== messages.length > 0)
        throw new Error(`Trivy returned an inconsistent image report for ${image}.`);
    return messages;
}

/**
 * Scan each literal service image once per Compose file.
 * @param input the engine input
 * @returns the findings
 */
export async function trivyImage(input: EngineInput): Promise<Finding[]> {
    const isCompose = pathMatcher(COMPOSE_FILES);
    const findings: Finding[] = [];
    for (const file of input.files) {
        if (!isCompose(file.path) || scopeOf(file.path, input.scopeEntries).path !== input.scope) continue;
        for (const image of composeImages(input, file.path)) {
            const messages = await scanImage(input, image);
            if (messages.length === 0) continue;
            findings.push(
                findingAt(
                    input,
                    { file: file.path, line: 1 },
                    'image',
                    `${image}: ${messages.slice(0, SHOWN_FINDINGS).join(' | ')}`,
                ),
            );
        }
    }
    return findings;
}
