/** The operating systems and architectures whose standalone archives are published. */
export const BINARY_TARGETS = {
    'linux-x64': 'bun-linux-x64',
    'linux-arm64': 'bun-linux-arm64',
    'darwin-x64': 'bun-darwin-x64',
    'darwin-arm64': 'bun-darwin-arm64',
    'windows-x64': 'bun-windows-x64',
} as const;

export const STANDALONE_DEFINES = { GSPOT_STANDALONE: 'true' };

export const ARCHIVE_TIMEOUT_MS = 120_000;

export const ARCHIVE_ENV = { COPYFILE_DISABLE: '1' };

export const CHECKSUM_PATTERN = /^(?<checksum>[a-f\d]{64}) {2}(?<name>[^/\\\n]+)$/u;
