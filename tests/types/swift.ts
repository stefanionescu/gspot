export type SwiftlintOutput = Record<
    'function_body_length' | 'file_length' | 'line_length' | 'trailing_comma',
    unknown
> &
    Record<'disabled_rules' | 'opt_in_rules', string[]>;
