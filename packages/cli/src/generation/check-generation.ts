import { convertToGlobs } from '#cli/configurations/ignores.ts';
import { buildConfigs } from '#cli/generation/configs.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildGspotSection } from '#cli/generation/ignores.ts';
import { listStaleFiles } from '#cli/generation/stale.ts';
import { writeEveryGeneratedFile } from '#cli/generation/write.ts';
import { openFiles } from '#cli/system/files/open.ts';
import type { CheckGeneration } from '#cli/types/engine/run.ts';

export const CHECK_GENERATION: CheckGeneration = {
    buildConfigs,
    listStaleFiles: (session, flags) => listStaleFiles(session, buildGeneratedFiles(session), flags),
    listWrittenGlobs: (session) => convertToGlobs([buildGspotSection(session, buildConfigs(session))]),
    writeStaleFiles: async (session) => {
        const { written, updated, deleted } = await writeEveryGeneratedFile(session, openFiles(session.root));
        return [...written, ...updated, ...deleted];
    },
};
