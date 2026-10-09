import { PROSE_WORDS } from '#tests/config/samples/prose.ts';

/** Primitive exceptions share saved reasons and public mutation semantics. */
export const PRIMITIVE_EXCEPTIONS = [
    {
        key: 'site.sitemap_exclude',
        value: 'account/index.html',
        second: 'admin/index.html',
        defaults: ['404.html'],
    } as const,
    {
        key: 'dependencies.registry_hosts',
        value: 'registry.example.test',
        second: 'packages.example.test',
        defaults: ['registry.npmjs.org', 'registry.yarnpkg.com'],
    } as const,
    { key: 'words', value: PROSE_WORDS[0], second: PROSE_WORDS[1], defaults: {} } as const,
];

export const ROOT_PROJECT = '[agent_rules]\nenabled = false\n[scope."app"]\n[scope."sibling"]\n';

export const HOST_LOCKFILE = {
    packages: {
        'node_modules/first': { resolved: 'https://github.com/example/first/archive/abcdef.tar.gz' },
        'node_modules/second': { resolved: 'https://codeload.github.com/example/second/tar.gz/abcdef' },
        'node_modules/third': { resolved: 'https://github.com/example/third/archive/abcdef.tar.gz' },
    },
};
