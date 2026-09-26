import { z } from 'zod';
import { parse } from 'yaml';
import { join } from 'node:path';
import { scopeOf } from '#cli/repository/scopes.ts';
import type { Finding } from '#cli/checks/result.ts';
import { pathMatcher } from '#cli/repository/paths.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { readSource } from '#cli/repository/tracked.ts';
import { scopeFile } from '#cli/configurations/targets.ts';
import { runCheckCommand } from '#cli/execution/tool-runner.ts';
import { toolOutputDetail } from '#cli/execution/broken-tool.ts';

const FINDINGS_EXIT = 10;
const SHOWN_FINDINGS = 20;
const imageReportSchema = z.object({
    SchemaVersion: z.literal(2),
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
        let document: z.infer<typeof composeSchema>;
        try {
            document = composeSchema.parse(
                parse(readSource(input.root, file.path, input.observations).toString('utf8'), { merge: true }),
            );
        } catch (error) {
            throw new Error(`Cannot read Compose service images in ${file.path}.`, { cause: error });
        }
        const images = new Set(
            Object.values(document.services ?? {})
                .map((service) => service.image)
                .filter((image): image is string => image !== undefined && !image.includes('$')),
        );
        for (const image of images) {
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
            if (result.code !== 0 && result.code !== FINDINGS_EXIT)
                throw new Error(
                    `Trivy could not scan ${image}: ${toolOutputDetail(result, `exit ${String(result.code)}`)}`,
                );
            const report = imageReportSchema.parse(JSON.parse(result.stdout));
            const messages = (report.Results ?? []).flatMap((entry) => [
                ...(entry.Vulnerabilities ?? []).map(
                    (vulnerability) => `${vulnerability.VulnerabilityID} (${vulnerability.PkgName})`,
                ),
                ...(entry.Secrets ?? []).map((secret) => `${secret.RuleID}: ${secret.Title}`),
            ]);
            if ((result.code === FINDINGS_EXIT) !== messages.length > 0)
                throw new Error(`Trivy returned an inconsistent image report for ${image}.`);
            if (messages.length === 0) continue;
            findings.push({
                check: input.spec.name,
                file: file.path,
                line: 1,
                rule: 'image',
                message: `${image}: ${messages.slice(0, SHOWN_FINDINGS).join(' | ')}`,
                fixable: false,
            });
        }
    }
    return findings;
}

const COMPOSE_FILES = ['**/docker-compose*.yml', '**/docker-compose*.yaml', '**/compose*.yml', '**/compose*.yaml'];
