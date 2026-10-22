export const CODE_FILE_TAGS: ReadonlySet<string> = new Set(['javascript', 'typescript']);

export const ESLINT_DIRECTIVE = /eslint-(?:disable|enable)(?:-next-line|-line)?(?<rules>[^\n]*)/gu;

export const DIRECTIVE_TAIL = /--|\*\//u;
