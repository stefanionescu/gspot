import { listRepositoryFiles, readRepository } from '#cli/repository/read.ts';
import { createRunCache } from '#cli/system/cache.ts';
import type { Repository } from '#cli/types/repository.ts';

/**
Read the files of a sandbox with the shipped configurations, no scopes, and no generated or vendored paths.
*/
export async function readTestRepository(root: string): Promise<Repository> {
    const cache = createRunCache(root);
    return readRepository(cache, await listRepositoryFiles(cache), { generatedPaths: [], scopes: [] });
}
