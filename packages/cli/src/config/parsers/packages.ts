import { TOOLS_PROJECT } from '#cli/config/platform/locations.ts';

export const REQUIREMENT_NAME_END = /[\s<>=!~;[@]/u;

export const SWIFT_PACKAGE_URL = /url:\s*"([^"]+)"/gu;

/** Literal identity shared by the npm tool-project generator and validator. */
export const NPM_TOOL_PROJECT = { name: TOOLS_PROJECT, private: true, type: 'module' } as const;

/** Literal identity and Python floor shared by the Python project generator and validator. */
export const PYTHON_MIN_VERSION = '3.11';
export const PYTHON_TOOL_PROJECT = {
    name: TOOLS_PROJECT,
    version: '0.0.0',
    'requires-python': `>=${PYTHON_MIN_VERSION}`,
} as const;
/** The first Yarn major that reads .yarnrc.yml and drops the Classic flags. */
export const YARN_BERRY_MAJOR = 2;
export const JAVASCRIPT_RUNTIMES = ['node', 'bun', 'deno'] as const;

export const RUNTIME_COMMAND = /^\s*(node|bun|deno)(?:\s|$)/u;
