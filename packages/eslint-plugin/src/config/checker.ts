export const FUNCTION_TYPE_TEXT = /^[(<]/u;

export const READONLY_TYPE_PREFIX = 'readonly ';

export const TYPED_ARRAY_SUFFIX = 'Array';

export const TYPE_ARGUMENTS_END = '>';

export const TYPE_ARGUMENTS_START = '<';

export const RETURN_DOC_TAGS: ReadonlySet<string> = new Set(['return', 'returns']);

export const UNKNOWN_TYPE_NAMES: ReadonlySet<string> = new Set(['any', 'unknown', 'never']);

export const ANY_TYPE = 'any';

export const TRUE_TYPE = 'true';

export const BOXED_STRING_NAME = 'String';

export const SANITATION_MEMBERS = 2;
