// The literal values tools reads: names, patterns, limits, and tables.

/** The name of the private npm and Python projects that hold the tools: unscoped, because PyPI has no scopes. */
export const TOOLS_PROJECT = 'gspot-tools';

/** The style directory under .gspot and the style Vale reads from it. */
export const STYLES_DIRECTORY = '.gspot/config/vale/styles';

export const VALE_CONFIG = '.gspot/config/vale.ini';

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
    bash: 'install Bash 4.4 or newer, such as with brew install bash on macOS',
};
export const PLATFORM_INSTALLERS: { platform: NodeJS.Platform; installer: string; command: string }[] = [
    { platform: 'darwin', installer: 'brew', command: 'brew install' },
    { platform: 'linux', installer: 'apt', command: 'sudo apt install' },
    { platform: 'win32', installer: 'winget', command: 'winget install' },
    { platform: 'win32', installer: 'scoop', command: 'scoop install' },
];
export const MANAGED_PREFIX = '.gspot/';
export const TOOL_ENV = { NO_COLOR: '1', FORCE_COLOR: '0' };
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
