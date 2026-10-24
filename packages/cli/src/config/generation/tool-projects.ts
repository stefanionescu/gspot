import { PYTHON_VERSION } from '#cli/config/install/python/project.ts';

export const NPM_TOOL_PROJECT = { private: true } as const;

export const PYTHON_TOOL_PROJECT = {
    name: 'tools',
    version: '0.0.0',
    'requires-python': `==${PYTHON_VERSION}`,
} as const;

export const YARN_TOOL_PROJECT_SETTINGS = 'nodeLinker: node-modules\nenableGlobalCache: true\n';

export const UV_PROJECT_TABLE = '[tool.uv]';
