export const SWIFT_TYPE_NODES = ['class_declaration', 'protocol_declaration', 'typealias_declaration'] as const;

export const SWIFT_NAME_QUOTE = '`';

const SWIFT_FUNCTION_NODES = ['function_declaration', 'protocol_function_declaration'] as const;

export const SWIFT_CALLABLE_NODES = [...SWIFT_FUNCTION_NODES, 'init_declaration'] as const;

export const SWIFT_MEMBER_PARENTS = new Set(['class_body', 'protocol_body', 'enum_class_body']);
