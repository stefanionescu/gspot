import { MISE_TOOL } from '#cli/config/tools/locate.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';

export const MISE_TRUST_ARGUMENTS = [MISE_TOOL, 'trust', GSPOT_PATHS.miseProject] as const;

export const MISE_INSTALL_ARGUMENTS = [MISE_TOOL, 'install'] as const;

const MISE_PLATFORMS = ['linux-x64', 'linux-arm64', 'macos-x64', 'macos-arm64', 'windows-x64'] as const;

export const MISE_LOCK_ARGUMENTS = [MISE_TOOL, 'lock', '--platform', MISE_PLATFORMS.join(',')] as const;

export const MISE_LOCKED_ENVIRONMENT = { MISE_LOCKED: '1' } as const;

export const MISE_CHECKSUM_PATTERN = /^(?:sha256|blake3):[a-f0-9]{64}$/u;

export const MISE_PLATFORM_PREFIX = 'platforms.';

export const MISE_TRUST_NOTE = 'trusted .gspot/mise.toml for mise';

export const MISE_TRUSTED_PATHS_VARIABLE = 'MISE_TRUSTED_CONFIG_PATHS';

export const MISE_CEILING_PATHS_VARIABLE = 'MISE_CEILING_PATHS';
