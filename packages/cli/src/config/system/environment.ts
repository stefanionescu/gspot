export const OPERATING_SYSTEMS = [
    { nodeName: 'darwin', name: 'macos', label: 'macOS' },
    { nodeName: 'linux', name: 'linux', label: 'Linux' },
    { nodeName: 'win32', name: 'windows', label: 'Windows' },
] as const;

export const CACHE_FOLDER_NAME = 'gspot';

export const CACHE_FOLDER_MESSAGE =
    'The cache folder must be an absolute path. Set XDG_CACHE_HOME or LOCALAPPDATA to an absolute path.';
