import type { ScopeSelection } from '#cli/types/policy/settings.ts';
import type { PackageInstallerIdentity } from '#cli/types/parsers/packages.ts';

/** Effective scopes and their shared, lazy repository package installer selection. */
export type ScopeSelections = {
    scopes: ScopeSelection[];
    selectInstaller: () => Promise<PackageInstallerIdentity>;
};
