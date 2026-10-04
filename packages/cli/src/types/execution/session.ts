import type { Manifest } from '#cli/types/configurations.ts';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import type { ToolSearch } from '#cli/types/tools/install.ts';
import type { Repository } from '#cli/types/repository/inventory.ts';
import type { PackageInstaller } from '#cli/types/parsers/packages.ts';
import type { PolicyFile, ScopeSelection } from '#cli/types/policy/settings.ts';

export type Session = ToolSearch & {
    reads: ReadCache;
    resources?: DisposableStack;
    packageInstaller: () => PackageInstaller | undefined;
    /** One lazily acquired Python installer for every lock and install operation in this command. */
    pythonInstaller: () => Promise<string>;
    cancelSignal?: AbortSignal;
    version: string;
    policyFiles: PolicyFile;
    manifests: Map<string, Manifest>;
    repository: Repository;
    scopes: ScopeSelection[];
};
