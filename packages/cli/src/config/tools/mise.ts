import { MISE_CONFIG_FILE, MISE_LOCKFILE } from '#cli/config/manifests.ts';
import { MISE_PROGRAM } from '#cli/config/system.ts';

// mise install
export const GITHUB_RATE_LIMIT = /rate limit|No lockfile URL found/iu;
export const GITHUB_TOKEN_MESSAGE =
    'GitHub limits the release lookups of mise without a token. Set GITHUB_TOKEN to a GitHub token, then run gspot install again.';
export const MISE_CHECKSUM_PATTERN = /^(?:sha256|blake3):[a-f0-9]{64}$/u;
export const MISE_FORCE_FLAG = '--force';
export const MISE_INSTALL_ARGUMENTS = [MISE_PROGRAM, 'install'] as const;
export const MISE_LOCKED_ENVIRONMENT = { MISE_LOCKED: '1' } as const;
const MISE_PLATFORMS = ['linux-x64', 'linux-arm64', 'macos-x64', 'macos-arm64', 'windows-x64'] as const;
export const MISE_LOCK_ARGUMENTS = [MISE_PROGRAM, 'lock', '--platform', MISE_PLATFORMS.join(',')] as const;
export const MISE_LOCK_ENVIRONMENT = { MISE_GITHUB_ATTESTATIONS: 'false', MISE_SLSA: 'false' } as const;
export const MISE_PLATFORM_PREFIX = 'platforms.';
export const MISE_RELEASE_HOSTS = new Set(['github.com', 'api.github.com', 'dl.deno.land']);
export const MISE_RELEASE_PROTOCOL = 'https:';
export const MISE_TOOL_NOUN = 'mise tool';

// mise lookup
export const MISE_BIN_PATHS_ARGUMENTS = [MISE_PROGRAM, 'bin-paths'] as const;
export const MISE_LAUNCHER_FOLDER = 'shims';
export const MISE_TOOL_SOURCE_ARGUMENTS = ['ls', '--current', '--json'] as const;
export const MISE_WHICH = 'which';

// mise trust
export const MISE_CEILING_PATHS_VARIABLE = 'MISE_CEILING_PATHS';
export const MISE_CONFIG_NAMES: ReadonlySet<string> = new Set(['.tool-versions', '.config']);
export const MISE_CONFIG_PREFIXES = ['mise', '.mise', '.rtx'] as const;
export const MISE_PROJECT_FILES = new Set([MISE_CONFIG_FILE, MISE_LOCKFILE]);
export const MISE_PROJECT_MESSAGE =
    'gspot runs mise in .gspot only when no other mise config sits beside .gspot/mise.toml. Delete the other mise files in .gspot, such as mise.local.toml, then run gspot install.';
export const MISE_STALE_PROJECT_MESSAGE =
    'gspot runs mise in .gspot only while .gspot/mise.toml is the file that gspot generates. Run gspot install.';
export const MISE_TRUSTED_PATHS_VARIABLE = 'MISE_TRUSTED_CONFIG_PATHS';
