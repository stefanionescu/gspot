export const REQUIREMENT_NAME_END = /[\s<>=!~;[@]/u;

export const SWIFT_PACKAGE_URL = /url:\s*"([^"]+)"/gu;

/** Literal identity shared by the npm tool-project generator and validator. */
export const NPM_TOOL_PROJECT = { private: true } as const;

/** Literal identity and pinned Python version shared by the Python project generator and validator. */
export const PYTHON_VERSION = '3.13.16';
export const PYTHON_TOOL_PROJECT = {
    name: 'tools',
    version: '0.0.0',
    'requires-python': `==${PYTHON_VERSION}`,
} as const;
/** The first Yarn major that reads .yarnrc.yml and drops the Classic flags. */
export const YARN_BERRY_MAJOR = 2;
export const JAVASCRIPT_RUNTIMES = ['node', 'bun', 'deno'] as const;

export const RUNTIME_COMMAND = /^\s*(node|bun|deno)(?:\s|$)/u;

export const NEXT_ESLINT_PLUGIN = '@next/eslint-plugin-next';
export const NEXT_ESLINT_PLUGIN_MAJOR = /^\^(?:0|[1-9]\d*)$/u;

export const PACKAGE_JSON = 'package.json';

export const PYPROJECT_TOML = 'pyproject.toml';

export const REQUIREMENTS_FILE = /(?:^|\/)requirements[^/]*\.txt$/u;

export const NPM_CLIENTS = ['npm', 'bun', 'pnpm', 'yarn'] as const;

export const PACKAGE_SWIFT = 'Package.swift';

export const REQUIREMENT_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/u;

export const LINE_CONTINUATION = /\\\r?\n/gu;

export const INLINE_COMMENT = /\s#/u;

export const GIT_SUFFIX = '.git';

export const PYTHON_NAME_SEPARATORS = /[._-]+/gu;

export const PYTHON_IDENTITY_NAME = /^[^@]+(?=@)/u;

export const NPM_CLIENT_HASH_SUFFIX = '+sha';

export const PIPFILE = 'Pipfile';
