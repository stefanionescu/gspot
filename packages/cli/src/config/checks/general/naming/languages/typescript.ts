export const TYPESCRIPT_PATTERN_FIELDS: Readonly<Record<string, string>> = {
    pair_pattern: 'value',
    object_assignment_pattern: 'left',
    assignment_pattern: 'left',
} as const;

export const TYPESCRIPT_NAME_NODES = new Set([
    'identifier',
    'property_identifier',
    'private_property_identifier',
    'type_identifier',
]);

export const TYPESCRIPT_PATTERN_LISTS = new Set(['rest_pattern', 'object_pattern', 'array_pattern']);

export const TYPESCRIPT_PARAMETER_NODES: ReadonlySet<string> = new Set(['required_parameter', 'optional_parameter']);

export const COMPONENT_FACTORY = /^(?:React\.)?(?:createContext|lazy|memo|forwardRef)$|^styled\b/u;

const TYPESCRIPT_FUNCTION_NODES = [
    'function_declaration',
    'generator_function_declaration',
    'function_expression',
] as const;

const TYPESCRIPT_METHOD_NODES = ['method_definition', 'method_signature', 'abstract_method_signature'] as const;

export const TYPESCRIPT_DECLARATIONS = [
    [TYPESCRIPT_FUNCTION_NODES, 'functions'],
    [TYPESCRIPT_METHOD_NODES, 'methods'],
    [['class_declaration', 'abstract_class_declaration'], 'classes'],
    [['interface_declaration', 'type_alias_declaration', 'enum_declaration'], 'types'],
    [['public_field_definition', 'property_signature'], 'properties'],
    [['enum_assignment'], 'enum_cases'],
] as const;

export const TYPESCRIPT_CALLABLE_NODES = [
    ...TYPESCRIPT_FUNCTION_NODES,
    ...TYPESCRIPT_METHOD_NODES,
    'arrow_function',
] as const;
