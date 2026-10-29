import { createReadCache } from '#cli/system/files/cache.ts';
import type { Repository } from '#cli/types/repository/files.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { readRepository, listRepositoryFiles } from '#cli/repository/read.ts';

/**
Read the files of a sandbox with the shipped configurations, no scopes, and no generated or vendored paths.
*/

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 37 calls in 9 files share it.
export async function readTestRepository(root: string): Promise<Repository> {
    const reads = createReadCache(root);
    return readRepository(reads, await listRepositoryFiles(reads), {
        generatedPaths: [],
        scopes: [],
        configurationsByName: readConfigurations(),
    });
}
