// One JavaScript and one Python lockfile: the parsing of every format is a unit test.
export const LOCKFILES: [string, string][] = [
    ['package-lock.json', '{"lockfileVersion":3,"packages":{"node_modules/example":{"version":"1.2.3"}}}'],
    ['uv.lock', 'version = 1\n[[package]]\nname = "example"\nversion = "1.2.3"\n'],
];
