/** Primitive exception lists share saved reasons and public mutation semantics. */
export const PRIMITIVE_EXCEPTIONS = [
    { key: 'tools.prettier.exclude', value: 'generated/**', second: 'vendor/**', defaults: [] },
    { key: 'site.sitemap_exclude', value: 'account/index.html', second: 'admin/index.html', defaults: ['404.html'] },
    {
        key: 'dependencies.registry_hosts',
        value: 'registry.example.test',
        second: 'packages.example.test',
        defaults: ['registry.npmjs.org', 'registry.yarnpkg.com'],
    },
];

export const EXCEPTION_REASON = 'The project contract requires this reviewed exception.';

export const ROOT_PROJECT =
    'require_reasons = true\n[agent_rules]\nenabled = false\n[[scope]]\npath = "app"\n[[scope]]\npath = "sibling"\n';

export const HOST_LOCK = {
    packages: {
        'node_modules/first': { resolved: 'https://github.com/example/first/archive/abcdef.tar.gz' },
        'node_modules/second': { resolved: 'https://codeload.github.com/example/second/tar.gz/abcdef' },
        'node_modules/third': { resolved: 'https://github.com/example/third/archive/abcdef.tar.gz' },
    },
};

/** Project names reach Vale after the saved list reason is unwrapped. */
export const PROSE_WORDS = ['NebulaConfiguration', 'OrbitalLedger'] as const;
