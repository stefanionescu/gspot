import type { DOCSTRING_STYLES } from '#cli/config/checks/python.ts';

/** Docstring arguments and the authored or inherited style, before source detection. */
export type PydoclintOptions = { command: string[]; style: PythonDocstringStyle | undefined };

/** The styles accepted by the Python docstring checker. */
export type PythonDocstringStyle = (typeof DOCSTRING_STYLES)[number];
