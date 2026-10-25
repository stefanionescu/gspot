export const OUTDATED_TOOL_PROJECTS = [
    { name: 'an edited mise.toml', path: '.gspot/mise.toml', text: '[tools]\n' },
    { name: 'a pyproject.toml that apply no longer writes', path: '.gspot/pyproject.toml', text: '[project]\n' },
] as const;

export const FAILED_NPM_VERSION = {
    code: 7,
    missing: false,
    duration: 0,
    stdout: '',
    stderr: 'version lookup failed',
} as const;
