import type { Manifest } from '#cli/types/configurations.ts';
import type { ScopeEntry, FileDeclaration } from '#cli/types/repository/inventory.ts';

export type RepositoryReadOptions = {
    declarations: FileDeclaration[];
    scopeEntries: Pick<ScopeEntry, 'path' | 'configurations'>[];
    manifests: Map<string, Manifest>;
};
