// The literal values tools reads: names, patterns, limits, and tables.

export const HOST_ONLY = new Set([
    'bash',
    'git',
    'docker',
    'xcodebuild',
    'plutil',
    'xcstringstool',
    'swift',
    'xmllint',
]);
export const MISE_CONFIG_PATH = '.mise/conf.d/gspot-tools.toml';
export const MISE_MIN_VERSION = '2026.8.8';
export const VERSION_TIMEOUT_MS = 15_000;
// What a mise shim prints when no configuration in reach names a version of the tool.
export const NO_VERSION = 'No version is set for shim';
export const UV_INSTALLER = { name: 'uv', version: '0.12.13' };
export const MISE_BACKENDS: { installer: string; prefix: string }[] = [
    { installer: 'mise', prefix: '' },
    { installer: 'npm', prefix: 'npm:' },
    { installer: 'pypi', prefix: 'pipx:' },
    { installer: 'github', prefix: 'github:' },
    { installer: 'cargo', prefix: 'cargo:' },
];
export const HOST_HINTS: Record<string, string> = {
    xcodebuild: 'install Xcode from the App Store',
    plutil: 'install Xcode from the App Store',
    xcstringstool: 'install Xcode from the App Store',
    docker: 'install Docker Desktop or the docker engine',
    bash: "install bash through your platform's package manager",
};
export const PLATFORM_INSTALLERS: { platform: NodeJS.Platform; installer: string; command: string }[] = [
    { platform: 'darwin', installer: 'brew', command: 'brew install' },
    { platform: 'linux', installer: 'apt', command: 'sudo apt install' },
    { platform: 'win32', installer: 'winget', command: 'winget install' },
    { platform: 'win32', installer: 'scoop', command: 'scoop install' },
];
export const MANAGED_PREFIX = '.gspot/';
export const TOOL_ENV = { NO_COLOR: '1', FORCE_COLOR: '0' };
export const MILLISECONDS = 1000;
export const TOOL_PYTHON_PROJECT = '.gspot/pyproject.toml';
export const LOCK = '.gspot/uv.lock';
export const SETUP = 'Run: gspot apply, then gspot install';
export const INDEX_SETTINGS = new Set([
    'index',
    'index-url',
    'extra-index-url',
    'find-links',
    'index-strategy',
    'keyring-provider',
    'native-tls',
    'system-certs',
    'allow-insecure-host',
    'offline',
]);
