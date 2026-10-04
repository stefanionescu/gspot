export const LOCK_CASES: [string, string][] = [
    ['package-lock.json', '{"lockfileVersion":3,"packages":{"node_modules/example":{"version":"1.2.3"}}}'],
    ['bun.lock', '{"lockfileVersion":1,"packages":{"example":["example@1.2.3","",{},"sha512-fixture"]}}'],
    ['pnpm-lock.yaml', 'lockfileVersion: "9.0"\npackages:\n  example@1.2.3(peer@2.0.0): {}\n'],
    [
        'yarn.lock',
        '__metadata:\n  version: 8\n  cacheKey: 10c0\n"example@npm:^1.0.0":\n  version: 1.2.3\n  resolution: "example@npm:1.2.3"\n',
    ],
    ['uv.lock', 'version = 1\n[[package]]\nname = "example"\nversion = "1.2.3"\n'],
    ['poetry.lock', '[[package]]\nname = "example"\nversion = "1.2.3"\n'],
    ['pdm.lock', '[[package]]\nname = "example"\nversion = "1.2.3"\n'],
];
