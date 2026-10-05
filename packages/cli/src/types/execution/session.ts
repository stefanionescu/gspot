import type { Manifest } from '#cli/types/configurations.ts';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import type { ToolSearch } from '#cli/types/tools/install.ts';
import type { PythonPreparation } from '#cli/types/tools/python.ts';
import type { Repository } from '#cli/types/repository/inventory.ts';
import type { PackageInstaller } from '#cli/types/parsers/packages.ts';
import type { PolicyFile, ScopeSelection } from '#cli/types/policy/settings.ts';

export type Session = ToolSearch &
    PythonPreparation & {
        reads: ReadCache;
        resources?: DisposableStack;
        packageInstaller: () => PackageInstaller | undefined;
        cancelSignal?: AbortSignal;
        version: string;
        policyFiles: PolicyFile;
        manifests: Map<string, Manifest>;
        repository: Repository;
        scopes: ScopeSelection[];
    };
