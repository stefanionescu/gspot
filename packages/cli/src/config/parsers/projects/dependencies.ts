export const REQUIREMENT_NAME_END = /[\s<>=!~;[@]/u;

export const JAVASCRIPT_RUNTIMES = ['node', 'bun', 'deno'] as const;

export const RUNTIME_COMMAND = /^\s*(node|bun|deno)(?:\s|$)/u;

export const PACKAGE_JSON = 'package.json';

export const PYPROJECT_TOML = 'pyproject.toml';

export const PACKAGE_SWIFT = 'Package.swift';

export const REQUIREMENT_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/u;

export const LINE_CONTINUATION = /\\\r?\n/gu;

export const INLINE_COMMENT = /\s#/u;

export const GIT_SUFFIX = '.git';

export const PYTHON_NAME_SEPARATORS = /[._-]+/gu;

export const PIPFILE = 'Pipfile';
