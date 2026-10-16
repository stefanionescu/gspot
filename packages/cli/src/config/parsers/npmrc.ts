/** The marks that start an .npmrc comment line. */
export const NPMRC_COMMENT_MARKS = ['#', ';'] as const;

/** The suffix that marks an .npmrc key as a list, as in `key[]=value`. */
export const NPMRC_LIST_SUFFIX = '[]';
