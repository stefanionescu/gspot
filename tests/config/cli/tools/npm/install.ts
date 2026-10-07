import type { YarnOperations } from '#tests/types/cli/npm.ts';

export const YARN_MANAGERS: YarnOperations[] = [
    {
        installer: { name: 'yarn', version: '1.22.22' },
        lockfile: ['yarn', 'install'],
        install: ['yarn', 'install', '--frozen-lockfile'],
        settings: false,
    },
    {
        installer: { name: 'yarn', version: '4.12.0' },
        lockfile: ['yarn', 'install', '--mode=update-lockfile'],
        install: ['yarn', 'install', '--immutable'],
        settings: true,
    },
];

/** Download failures that identify both GitHub and its refusal. */
export const GITHUB_DOWNLOAD_FAILURES = [
    'error: Request to https://api.github.com/repos/editorconfig-checker/editorconfig-checker/releases/tags/v3.4.0 failed with status 403',
    'Error: HTTP 403 from https://github.com/editorconfig-checker/editorconfig-checker/releases/download/v3.4.0/ec-darwin-arm64.tar.gz',
    'GET https://api.github.com/repos/example/tool/releases: API rate limit exceeded for 203.0.113.9.',
];

/** Registry failures and unrelated GitHub output do not establish a refused GitHub download. */
export const OTHER_DOWNLOAD_OUTPUT = [
    '',
    'error: package "left-pad@0.0.1" not found',
    'HTTP 403 from https://registry.example.com/private-tool',
    'API rate limit exceeded for 203.0.113.9.',
    'GET https://registry.example.com/private-tool: API rate limit exceeded',
    'Downloading https://api.github.com/repos/example/tool/releases',
    'HTTP 403 from https://api.github.com.example.com/repos/example/tool/releases',
    'HTTP 403 from https://github.com@example.com/example/tool/releases',
    'HTTP 403 from https://github.com/example/tool/issues',
    'Downloading https://api.github.com/repos/example/tool/releases\nHTTP 403 from https://registry.example.com/private-tool',
    'HTTP 403 from https://registry.example.com/private-tool\nDownloading https://github.com/example/tool/releases/latest',
];

export const PACKAGE_FAILURES = [
    { frozen: false, refusal: 'HTTP 403 Forbidden' },
    { frozen: true, refusal: 'HTTP 403 Forbidden' },
    { frozen: false, refusal: 'error: private-check-tool@1.0.0 was not found' },
    { frozen: true, refusal: 'error: private-check-tool@1.0.0 was not found' },
];
