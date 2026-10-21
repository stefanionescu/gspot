import type { Configuration } from '#cli/types/configurations.ts';
import type { ScopeFolder, GeneratedPaths } from '#cli/types/repository/inventory.ts';

export type RepositoryReadOptions = {
    generatedPaths: GeneratedPaths[];
    scopes: Pick<ScopeFolder, 'path' | 'configurations'>[];
    configurations: Map<string, Configuration>;
};
