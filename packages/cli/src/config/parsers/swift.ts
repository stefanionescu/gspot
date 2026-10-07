/** Grammar nodes with executable Swift bodies for functions, accessors, and observers. */
export const SWIFT_BODY_NODES = [
    'function_declaration',
    'init_declaration',
    'deinit_declaration',
    'lambda_literal',
    'computed_getter',
    'computed_setter',
    'computed_property',
    'willset_clause',
    'didset_clause',
];

/** Plain finding labels for anonymous bodies and initializer declarations. */
export const FUNCTION_NAMES: Record<string, string> = {
    init_declaration: 'init',
    deinit_declaration: 'deinit',
    lambda_literal: 'closure',
    computed_getter: 'getter',
    computed_setter: 'setter',
    computed_property: 'getter',
    willset_clause: 'willSet observer',
    didset_clause: 'didSet observer',
};

/** Accessor and observer bodies receive the name of their declaring property. */
export const ACCESSOR_NODES = new Set([
    'computed_getter',
    'computed_setter',
    'computed_property',
    'willset_clause',
    'didset_clause',
]);
