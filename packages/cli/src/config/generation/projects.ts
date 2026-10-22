/** Fixed fields of the npm tool project that its generator and validator share. */
export const NPM_TOOL_PROJECT = { private: true } as const;

/** The Python version that the Python tool project pins. */
export const PYTHON_VERSION = '3.13.16';

export const PYTHON_TOOL_PROJECT = {
    name: 'tools',
    version: '0.0.0',
    'requires-python': `==${PYTHON_VERSION}`,
} as const;

export const NEXT_ESLINT_PLUGIN = '@next/eslint-plugin-next';

export const NEXT_ESLINT_PLUGIN_MAJOR = /^\^(?:0|[1-9]\d*)$/u;

/** Yarn tool projects use a local node_modules tree with the shared package cache. */
export const YARN_TOOL_PROJECT_SETTINGS = 'nodeLinker: node-modules\nenableGlobalCache: true\n';

export const NEXT_PACKAGE = 'next';

export const UV_PROJECT_TABLE = '[tool.uv]';
