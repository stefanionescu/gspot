export const NPMRC_REFUSALS = [
    {
        name: 'a registry password with a broken percent escape',
        source: 'registry=https://u:pa%zz@host/\n',
        message: 'A registry URL in the .npmrc files is not valid.',
    },
    {
        name: 'a registry that is not a URL',
        source: 'registry=not-a-valid-url\n',
        message: 'A registry URL in the .npmrc files is not valid.',
    },
    {
        name: 'a number setting with text',
        source: 'maxsockets=not-a-number\n',
        message: 'The .npmrc settings are not valid.',
    },
] as const;

export const LINKED_NODE_FILES = {
    'actual/bin/node': '',
    'actual/etc/npmrc': 'registry=https://actual.example/\n',
    'linked/bin/.keep': '',
    'linked/etc/npmrc': 'registry=https://wrong.example/\n',
    'project/package.json': '{"private":true}',
};

export const NPM_PREFIX_ENVIRONMENT = {
    PREFIX: undefined,
    npm_config_prefix: undefined,
    NPM_CONFIG_PREFIX: undefined,
    npm_config_globalconfig: undefined,
    NPM_CONFIG_GLOBALCONFIG: undefined,
    NPM_CONFIG_USERCONFIG: undefined,
    npm_config_registry: undefined,
    NPM_CONFIG_REGISTRY: undefined,
};
