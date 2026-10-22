import type { DOCSTRING_STYLES } from '#cli/config/checks/language/python/pydoclint.ts';

/** The pydoclint command, and the docstring style that pyproject.toml sets for pydoclint or Ruff, when it sets one. */
export type PydoclintOptions = { command: string[]; style: PythonDocstringStyle | undefined };

/** The styles that the Python docstring checker accepts. */
export type PythonDocstringStyle = (typeof DOCSTRING_STYLES)[number];

export type DeptryConfiguration = { tool: { deptry: { extend_exclude: string[]; known_first_party: string[] } } };

export type DocstringConfiguration = {
    tool: {
        pydoclint: { style?: PythonDocstringStyle | undefined } & Record<string, unknown>;
        ruff: { lint: { pydocstyle: { convention?: unknown } } };
    };
};
