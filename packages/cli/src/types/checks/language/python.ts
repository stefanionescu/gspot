import type { PythonDocstringStyle } from '#cli/types/parsers/python.ts';

/** Native docstring arguments and the authored or inherited style, before source detection. */
export type DocstringConfiguration = { command: string[]; style: PythonDocstringStyle | undefined };
