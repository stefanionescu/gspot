export const PATTERN_FIELDS: Readonly<Record<string, string>> = {
    pair_pattern: 'value',
    object_assignment_pattern: 'left',
    assignment_pattern: 'left',
};

export const NAME_NODES = new Set([
    'identifier',
    'property_identifier',
    'private_property_identifier',
    'type_identifier',
]);

export const PATTERN_LISTS = new Set(['rest_pattern', 'object_pattern', 'array_pattern']);

export const PARAMETER_NODES: ReadonlySet<string> = new Set(['required_parameter', 'optional_parameter']);

export const COMPONENT_FACTORY = /^(?:React\.)?(?:createContext|lazy|memo|forwardRef)$|^styled\b/u;

const FUNCTION_NODES = ['function_declaration', 'generator_function_declaration', 'function_expression'] as const;

const METHOD_NODES = ['method_definition', 'method_signature', 'abstract_method_signature'] as const;

export const DECLARATIONS = [
    [FUNCTION_NODES, 'functions'],
    [METHOD_NODES, 'methods'],
    [['class_declaration', 'abstract_class_declaration'], 'classes'],
    [['interface_declaration', 'type_alias_declaration', 'enum_declaration'], 'types'],
    [['public_field_definition', 'property_signature'], 'properties'],
    [['enum_assignment'], 'enum_cases'],
] as const;

export const CALLABLE_NODES = [...FUNCTION_NODES, ...METHOD_NODES, 'arrow_function'] as const;
