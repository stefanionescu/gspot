// Trivy over literal service images in tracked Compose files, on request.
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { readSource } from '#cli/repository/tracked.ts';
import { runCheckCommand } from '#cli/run/tool-runner.ts';
import type { EngineInput } from '#cli/types/execution.ts';
import type { Finding } from '#cli/types/reports.ts';
import { pathMatcher } from '#cli/configurations/claims.ts';


const SHOWN_LINES = 20;
const composeSchema = z.object({
    services: z.record(z.string(), z.object({ image: z.string().min(1).optional() })).optional(),
});

/** Scan each literal service image once per Compose file. */
export async function trivyImage(input: EngineInput): Promise<Finding[]> {
    const isCompose = pathMatcher(COMPOSE_FILES);
    const findings: Finding[] = [];
    for (const file of input.files) {
        if (!isCompose(file.path)) continue;
        let document: z.infer<typeof composeSchema>;
        try {
            document = composeSchema.parse(parse(readSource(input.root, file.path).toString('utf8'), { merge: true }));
        } catch (error) {
            throw new Error(`Cannot read Compose service images in ${file.path}.`, { cause: error });
        }
        const images = new Set(
            Object.values(document.services ?? {})
                .map((service) => service.image)
                .filter((image): image is string => image !== undefined && !image.includes('$')),
        );
        for (const image of images) {
            const result = await runCheckCommand(input, [
                'trivy', 'image', '--quiet', '--config', join(input.root, '.gspot/config/trivy.yaml'), '--exit-code', '1', image,
            ], { cwd: input.root });
            if (result.code === 0) continue;
            const lines = `${result.stdout}\n${result.stderr}`.split('\n').filter((line) => line.trim() !== '');
            findings.push({
                check: input.spec.name,
                file: file.path,
                line: 1,
                rule: 'image',
                message: `${image}: ${lines.slice(0, SHOWN_LINES).join(' | ')}`,
                fixable: false,
            });
        }
    }
    return findings;
}

const COMPOSE_FILES = [
    '**/docker-compose*.yml',
    '**/docker-compose*.yaml',
    '**/compose*.yml',
    '**/compose*.yaml',
];
