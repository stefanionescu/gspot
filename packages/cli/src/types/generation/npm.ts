import type { Manifest } from '#cli/types/configurations.ts';
import type { ScopeSelection } from '#cli/types/policy/settings.ts';
import type { PackageInstaller } from '#cli/types/parsers/packages.ts';

/** The selected repository projects and tools whose npm installation is generated once. */
export type NpmProjectInputs = {
    root: string;
    scopes: ScopeSelection[];
    manifests: Manifest[];
    installer: PackageInstaller | undefined;
};
