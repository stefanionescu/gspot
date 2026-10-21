import { MISE_TOOL } from '#cli/config/tools/inspection.ts';
import { MISE_TOOL_PROJECT_FILE } from '#cli/config/gspot-paths.ts';

export const MISE_TRUST_ARGUMENTS = [MISE_TOOL, 'trust', MISE_TOOL_PROJECT_FILE] as const;

export const MISE_INSTALL_ARGUMENTS = [MISE_TOOL, 'install'] as const;
