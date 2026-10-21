import type { DOCSTRING_STYLES } from '#cli/config/checks/python.ts';

/** Docstring arguments and the authored or inherited style, before source detection. */
export type PydoclintOptions = { command: string[]; style: PythonDocstringStyle | undefined };

/** The styles accepted by the Python docstring checker. */
export type PythonDocstringStyle = (typeof DOCSTRING_STYLES)[number];

export type DeptryConfiguration = { tool: { deptry: { extend_exclude: string[]; known_first_party: string[] } } };

export type DocstringConfiguration = {
    tool: {
        pydoclint: { style?: PythonDocstringStyle | undefined } & Record<string, unknown>;
        ruff: { lint: { pydocstyle: { convention?: unknown } } };
    };
};
