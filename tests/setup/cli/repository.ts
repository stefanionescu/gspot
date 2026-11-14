import { createRunCache } from '#cli/system/cache.ts';
import type { Repository } from '#cli/types/repository.ts';
import { readRepository, listRepositoryFiles } from '#cli/repository/read.ts';

export async function readTestRepository(root: string): Promise<Repository> {
    const cache = createRunCache(root);
    return readRepository(cache, await listRepositoryFiles(cache), { generatedPaths: [], scopes: [] });
}
