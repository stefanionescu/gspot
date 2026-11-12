import { convertToGlobs } from '#cli/configurations/ignores.ts';
import { buildConfigs } from '#cli/generation/configs.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildGspotSection } from '#cli/generation/ignores.ts';
import { listStaleFiles } from '#cli/generation/stale.ts';
import type { CheckGeneration } from '#cli/types/engine/run.ts';

export const CHECK_GENERATION: CheckGeneration = {
    buildConfigs,
    listStaleFiles: (session, flags) => listStaleFiles(session, buildGeneratedFiles(session), flags),
    listWrittenPaths: (session) => convertToGlobs([buildGspotSection(session, buildConfigs(session))]),
};
