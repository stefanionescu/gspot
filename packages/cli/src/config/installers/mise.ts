import { MISE_TOOL } from '#cli/config/tools/locate.ts';

export const MISE_INSTALL_ARGUMENTS = [MISE_TOOL, 'install'] as const;

const MISE_PLATFORMS = ['linux-x64', 'linux-arm64', 'macos-x64', 'macos-arm64', 'windows-x64'] as const;

export const MISE_LOCK_ARGUMENTS = [MISE_TOOL, 'lock', '--platform', MISE_PLATFORMS.join(',')] as const;

export const MISE_LOCKED_ENVIRONMENT = { MISE_LOCKED: '1' } as const;

export const MISE_CHECKSUM_PATTERN = /^(?:sha256|blake3):[a-f0-9]{64}$/u;

export const MISE_PLATFORM_PREFIX = 'platforms.';

export const MISE_RELEASE_HOSTS = new Set(['github.com', 'api.github.com', 'dl.deno.land']);

export const MISE_RELEASE_PROTOCOL = 'https:';

export const MISE_PROJECT_MESSAGE =
    'gspot runs mise in .gspot only when no other mise config file sits beside .gspot/mise.toml. Delete the other mise files in .gspot, such as mise.local.toml, then run gspot install.';

export const GITHUB_RATE_LIMIT = /rate limit/iu;

export const GITHUB_TOKEN_MESSAGE =
    'GitHub limits the release lookups of mise without a token. Set GITHUB_TOKEN to a GitHub token, then run gspot install again.';

export const MISE_TOOL_NOUN = 'mise tool';
