import { readConfigurations } from '#cli/manifests/read.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import type { Repository } from '#cli/types/repository/files.ts';
import { readRepository, listRepositoryFiles } from '#cli/repository/read.ts';

/**
Read the files of a sandbox with the shipped configurations, no scopes, and no generated or vendored paths.
*/

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Inlined, its repository read makes duplication/jscpd clones in the repository tests.
export async function readTestRepository(root: string): Promise<Repository> {
    const reads = createReadCache(root);
    return readRepository(reads, await listRepositoryFiles(reads), {
        generatedPaths: [],
        scopes: [],
        configurationsByName: readConfigurations(),
    });
}
