export const OUT_OF_MEMORY = /JavaScript heap out of memory|Reached heap limit/u;

export const TAIL_LINES = 20;

export const NO_ERROR_OUTPUT_MESSAGE = 'The tool printed no error output.';

export const OUT_OF_MEMORY_MESSAGE =
    'The tool ran out of memory. It most likely read build output or a bundle: keep that folder in .gitignore, or add an [[ignore]] with its paths.';

export const STACK_FRAME_LINE = /^\s+at /u;
