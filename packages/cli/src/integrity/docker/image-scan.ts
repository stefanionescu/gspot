// Trivy over every image a Compose file names, on request.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { run } from '#cli/platform/spawn.ts';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { pathMatcher } from '#cli/presets/claims.ts';
import { MissingToolError } from '#cli/platform/missing-tool.ts';
import { capturedLines } from '#cli/integrity/captured-lines.ts';
import { COMPOSE_FILES, COMPOSE_IMAGE } from '#config/integrity.ts';

const SCAN_TIMEOUT_MS = 1_800_000;
const SHOWN_LINES = 20;

async function scanned(input: EngineInput, file: string, image: string): Promise<Finding[]> {
    const argv = [
        'trivy',
        'image',
        '--quiet',
        '--config',
        join(input.root, '.gspot/trivy.yaml'),
        '--exit-code',
        '1',
        image,
    ];
    const result = await run(argv, { cwd: input.root, timeoutMs: SCAN_TIMEOUT_MS });
    if (result.missing) throw new MissingToolError('Trivy is not installed.');
    if (result.code === 0) return [];
    const said = `${result.stdout}\n${result.stderr}`.split('\n').filter((line) => line.trim() !== '');
    return [
        {
            check: input.spec.id,
            file,
            line: 1,
            rule: 'image',
            message: `${image}: ${said.slice(0, SHOWN_LINES).join(' | ')}`,
            fixable: false,
        },
    ];
}

/**
 * The image names in the text of one Compose file.
 * @param text the Compose file
 * @returns every image once, leaving out one that comes from a variable
 */
export function composeImages(text: string): string[] {
    return capturedLines(text, COMPOSE_IMAGE);
}

/**
 * Scans the images of every tracked Compose file.
 * @param input the engine input
 * @returns one finding for each image Trivy refuses
 */
export async function trivyImage(input: EngineInput): Promise<Finding[]> {
    const isCompose = pathMatcher(COMPOSE_FILES);
    const findings: Finding[] = [];
    for (const file of input.session.repository.files) {
        if (!isCompose(file.path)) continue;
        const images = composeImages(readFileSync(join(input.root, file.path), 'utf8'));
        for (const image of images) findings.push(...(await scanned(input, file.path, image)));
    }
    return findings;
}
