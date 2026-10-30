import { createRunCache } from '#cli/system/cache.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import type { Repository } from '#cli/types/repository/files.ts';
import { readRepository, listRepositoryFiles } from '#cli/repository/read.ts';

/**
Read the files of a sandbox with the shipped configurations, no scopes, and no generated or vendored paths.
*/

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Tests in many files read a sandbox repository through it, and jscpd reports the inlined copies as clones.
export async function readTestRepository(root: string): Promise<Repository> {
    const cache = createRunCache(root);
    return readRepository(cache, await listRepositoryFiles(cache), {
        generatedPaths: [],
        scopes: [],
        configurationsByName: readConfigurations(),
    });
}
