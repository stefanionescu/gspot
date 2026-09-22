// Prose analyses are selected while planning the run.
import type { Engine } from '#cli/run/types.ts';
import type { CheckSpec } from '#cli/presets/types.ts';
import { valeFindings } from '#cli/prose/vale.ts';
import { sourceBans } from '#cli/prose/source-bans.ts';

/** Resolve the declared prose analysis before executing any checks. */
export function resolveProse(spec: CheckSpec): Engine {
    if (spec.analysis === 'vale') return valeFindings;
    if (spec.analysis === 'source-bans') return sourceBans;
    throw new Error(`No prose analysis is called ${spec.analysis ?? ''}.`);
}
