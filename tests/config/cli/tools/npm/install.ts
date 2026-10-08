const AUTHORED_VERSION_INPUTS: Record<string, string> = {
    'package.json': '{"packageManager":"bun@0.0.0"}\n',
};

const RECORDED_VERSION_INPUTS: Record<string, string> = {
    'bun.lock': 'recorded root lockfile\n',
    '.gspot/package.json': '{"packageManager":"bun@0.0.0+sha512.0a1b2c"}\n',
};

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

export const PACKAGE_VERSION_CASES = [
    { source: 'authored', operation: 'lockfile', files: AUTHORED_VERSION_INPUTS } as const,
    { source: 'authored', operation: 'install', files: AUTHORED_VERSION_INPUTS } as const,
    { source: 'recorded', operation: 'lockfile', files: RECORDED_VERSION_INPUTS } as const,
    { source: 'recorded', operation: 'install', files: RECORDED_VERSION_INPUTS } as const,
];
