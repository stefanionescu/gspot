export const TYPE_NODES = ['class_declaration', 'protocol_declaration', 'typealias_declaration'] as const;

const FUNCTION_NODES = ['function_declaration', 'protocol_function_declaration'] as const;

export const CALLABLE_NODES = [...FUNCTION_NODES, 'init_declaration'] as const;

export const MEMBER_PARENTS = new Set(['class_body', 'protocol_body', 'enum_class_body']);
