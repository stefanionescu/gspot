import { MISE_TOOL } from '#cli/config/tools/locate.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';

export const MISE_TRUST_ARGUMENTS = [MISE_TOOL, 'trust', GSPOT_PATHS.miseProject] as const;

export const MISE_INSTALL_ARGUMENTS = [MISE_TOOL, 'install'] as const;
