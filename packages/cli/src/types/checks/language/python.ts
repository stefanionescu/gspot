import type { DOCSTRING_STYLES } from '#cli/config/checks/language/python/pydoclint.ts';

export type PydoclintOptions = { command: string[]; style: PythonDocstringStyle | undefined };

export type PythonDocstringStyle = (typeof DOCSTRING_STYLES)[number];

export type DeptryConfiguration = { tool: { deptry: { extend_exclude: string[]; known_first_party: string[] } } };

export type DocstringConfiguration = {
    tool: {
        pydoclint: { style?: PythonDocstringStyle | undefined } & Record<string, unknown>;
        ruff: { lint: { pydocstyle: { convention?: unknown } } };
    };
};
