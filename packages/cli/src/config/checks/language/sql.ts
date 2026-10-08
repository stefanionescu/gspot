// The PostgreSQL parser accepts only the postgres dialect; SQLFluff checks other dialects.
export const PARSED_DIALECTS = new Set(['postgres']);

export const OUTPUT_PARAMETERS = new Set(['FUNC_PARAM_OUT', 'FUNC_PARAM_TABLE']);
