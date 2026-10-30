export const DOCUMENTED_DECLARATIONS = ['function_declaration', 'init_declaration'] as const;

export const PUBLIC_VISIBILITIES: ReadonlySet<string> = new Set(['public', 'open']);

export const OVERRIDE_MODIFIER = 'override';

export const COMMENT_NODES: ReadonlySet<string> = new Set(['comment', 'multiline_comment']);

export const DOC_COMMENT_START = /^\/\/\/|^\/\*\*/u;

export const DOCUMENTED_PARAMETER = /^[\t */]*-[\t ]+(?:Parameter[\t ]+)?(?<name>\w+)[\t ]*:/gmu;

export const INITIALIZER_NAME = 'init';

export const UNNAMED_PARAMETER = '_';

export const MISSING_PARAMETER_RULE = 'missing-parameter';
