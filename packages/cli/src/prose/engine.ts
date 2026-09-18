import type { EngineInput } from '#types/run.ts';
// The prose engine: Vale and the source bans, chosen by `analysis =` in the manifest.
import type { Finding } from '#types/finding.ts';
import { valeFindings } from '#cli/prose/vale.ts';
import { sourceBans } from '#cli/prose/source-bans.ts';

/**
 * Runs the analysis a prose check names.
 * @param input the engine input
 * @returns the findings
 */
export function runProse(input: EngineInput): Promise<Finding[]> {
    const analysis = input.spec.analysis ?? '';
    if (analysis === 'vale') return valeFindings(input);
    if (analysis === 'source-bans') return sourceBans(input);
    throw new Error(`No prose analysis is called ${analysis}.`);
}
