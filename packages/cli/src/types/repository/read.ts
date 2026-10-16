import type { Manifest } from '#cli/types/configurations.ts';
import type { Scope, FileDeclaration } from '#cli/types/repository/inventory.ts';

export type RepositoryReadOptions = {
    declarations: FileDeclaration[];
    scopes: Pick<Scope, 'path' | 'configurations'>[];
    manifests: Map<string, Manifest>;
};
