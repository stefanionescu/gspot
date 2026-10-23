export const LANGUAGE_BY_EXTENSION = { '.py': 'python', '.swift': 'swift' } as const;

export const SOURCE_QUERIES = {
    bash: `(function_definition) @function
(variable_assignment) @assignment`,
    python: '(function_definition) @function',
    swift: `[(function_declaration body: (function_body)) (init_declaration) (deinit_declaration) (computed_getter)
(computed_setter) (computed_property (statements)) (willset_clause) (didset_clause)] @function
(do_statement) @block`,
} as const;
