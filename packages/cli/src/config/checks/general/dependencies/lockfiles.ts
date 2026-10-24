export const LOCKFILE_DOWNLOADS: ReadonlyMap<string, RegExp> = new Map([
    ['package-lock.json', /"resolved"\s*:\s*"([^"]+)"/gu],
    ['npm-shrinkwrap.json', /"resolved"\s*:\s*"([^"]+)"/gu],
    ['pnpm-lock.yaml', /resolution:\s*\{[^}]*?\b(?:tarball|repo):\s*["']?([^\s"',}]+)/gu],
    ['yarn.lock', /(?:resolved\s+"|resolution:\s*"[^"]+@)([a-z+]+:\/\/[^"]+)/gu],
    ['bun.lock', /:\s*\[\s*"[^"]*"\s*,\s*"([^"]*)"/gu],
]);

export const DOWNLOAD_PROTOCOLS: ReadonlySet<string> = new Set([
    'http:',
    'https:',
    'git:',
    'git+http:',
    'git+https:',
    'git+ssh:',
]);
