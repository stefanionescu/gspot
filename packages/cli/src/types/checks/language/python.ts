import type { DOCSTRING_STYLES } from '#cli/config/checks/language/python.ts';

export type PydoclintOptions = { command: string[]; style: PythonDocstringStyle | undefined };

export type PythonDocstringStyle = (typeof DOCSTRING_STYLES)[number];
