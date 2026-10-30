import type { Configuration } from '#cli/types/manifests.ts';
import type { ListedFile, Repository, ScopeFolder, GeneratedPaths } from '#cli/types/repository/files.ts';

export type RepositoryReadOptions = {
    generatedPaths: GeneratedPaths[];
    scopes: Pick<ScopeFolder, 'path' | 'configurations'>[];
    configurationsByName: Map<string, Configuration>;
};

export type RepositoryListing = Pick<Repository, 'root' | 'hasGit' | 'index' | 'attributes' | 'unreadablePaths'> & {
    files: (ListedFile & { prefix: Buffer })[];
};
