// The integrity engine: one function per check, chosen by `analysis =` in the manifest.
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { fences } from '#cli/integrity/fences.ts';
import type { IntegrityCheck } from '#types/integrity.ts';
import { envExample } from '#cli/integrity/env-example.ts';
import { stalePaths } from '#cli/integrity/stale-paths.ts';
import { readmeShape } from '#cli/integrity/readme/shape.ts';
import { docsHeadings } from '#cli/integrity/docs-headings.ts';
import { readmePresent } from '#cli/integrity/readme/present.ts';
import { generatedDrift } from '#cli/integrity/generated-drift.ts';
import { tsconfigOptions } from '#cli/integrity/tsconfig-options.ts';

const checks: Record<string, IntegrityCheck> = {
    'generated-drift': generatedDrift,
    'tsconfig-options': tsconfigOptions,
    'docs-headings': docsHeadings,
    'stale-paths': stalePaths,
    'readme-present': readmePresent,
    'readme-shape': readmeShape,
    fences,
    'env-example': envExample,
};

/**
 * Runs the analysis a check names.
 * @param input the engine input
 * @returns the findings
 */
export async function runIntegrity(input: EngineInput): Promise<Finding[]> {
    const name = input.spec.analysis ?? input.spec.id.slice(input.spec.id.indexOf('/') + 1);
    const check = checks[name];
    if (!check) throw new Error(`No integrity analysis is called ${name}.`);
    return check(input);
}
