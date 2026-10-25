export const NPM_TOOL_PROJECT = { name: 'tools', private: true } as const;

export const YARN_TOOL_PROJECT_SETTINGS =
    'nodeLinker: node-modules\nenableGlobalCache: true\ninstallStatePath: ./node_modules/.yarn-install-state.gz\n';

export const UV_PROJECT_TABLE = '[tool.uv]';
