export const OPERATING_SYSTEMS = [
    { nodeName: 'darwin', name: 'macos', label: 'macOS' },
    { nodeName: 'linux', name: 'linux', label: 'Linux' },
    { nodeName: 'win32', name: 'windows', label: 'Windows' },
] as const;

export const CACHE_FOLDER_NAME = 'gspot';

export const CACHE_FOLDER_MESSAGE =
    'The cache folder must be an absolute path. Set XDG_CACHE_HOME or LOCALAPPDATA to an absolute path.';

export const TOOL_VARIABLE_NAMES = new Set([
    'PATH',
    'PATHEXT',
    'HOME',
    'USER',
    'USERNAME',
    'LOGNAME',
    'SHELL',
    'TERM',
    'LANG',
    'LANGUAGE',
    'TZ',
    'TMPDIR',
    'TMP',
    'TEMP',
    'SYSTEMROOT',
    'WINDIR',
    'COMSPEC',
    'USERPROFILE',
    'APPDATA',
    'LOCALAPPDATA',
    'PROGRAMDATA',
    'PROGRAMFILES',
    'HOMEDRIVE',
    'HOMEPATH',
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'NO_PROXY',
    'ALL_PROXY',
    'SSL_CERT_FILE',
    'SSL_CERT_DIR',
    'NODE_EXTRA_CA_CERTS',
    'NODE_OPTIONS',
    'DEVELOPER_DIR',
    'CI',
    'GITHUB_ACTIONS',
    'GITLAB_CI',
    'DO_NOT_TRACK',
]);

export const TOOL_VARIABLE_PREFIXES = [
    'LC_',
    'XDG_',
    'GIT_',
    'MISE_',
    'NPM_CONFIG_',
    'BUN_',
    'PNPM_',
    'YARN_',
    'UV_',
    'DOCKER_',
] as const;

export const TOOL_OPT_OUT_VARIABLE = /TELEMETRY|SEND_METRICS/u;

export const CREDENTIAL_VARIABLE = /TOKEN|SECRET|PASSW|CREDENTIAL|AUTH|_KEY(?:_|$)/u;
