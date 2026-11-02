export const PERIPHERY_RETAIN = {
    retain_public: true,
    retain_objc_accessible: true,
    retain_assign_only_properties: true,
    retain_unused_protocol_func_params: true,
    retain_swift_ui_previews: true,
    retain_codable_properties: true,
} as const;

export const SWIFT_TOOLS_VERSION = /^\s*\/\/\s*swift-tools-version\s*:\s*(\d+(?:\.\d+){1,2})\b/u;

export const SWIFTFORMAT_COMMAS = { none: 'never', es5: 'collections-only', all: 'always' } as const;

export const SWIFTFORMAT_OFF_REASONS: Readonly<Record<string, string>> = {
    trailingClosures: '# SwiftLint trailing_closure owns closure syntax.',
    initCoderUnavailable:
        '# Inserts an availability attribute into UIKit initializers, a behavior change, not a layout one.',
    redundantInternal: '# SwiftLint owns explicit access annotations, so the formatter keeps them.',
    redundantPublic: '# SwiftLint owns explicit access annotations, so the formatter keeps them.',
};

export const SWIFTFORMAT_ALL_LEVEL_ON = ['blockComments', 'wrapEnumCases'] as const;

export const SWIFTFORMAT_OPTIONS = {
    'extension-acl': 'on-declarations',
    wraparguments: 'before-first',
    wrapparameters: 'before-first',
    wrapcollections: 'before-first',
    nospaceoperators: '...,..<',
    guardelse: 'next-line',
    importgrouping: 'length,alpha',
    self: 'init-only',
} as const;

export const SWIFT_FILES = ['**/*.swift'] as const;

export const SWIFTLINT_FUNCTION_NESTING = 2;

export const SWIFTLINT_COMMENTS = {
    identifier_name:
        ' The case and length of types, variables, parameters, and enum cases; naming/identifiers checks functions and methods.',
    disabled_rules: ' SwiftFormat owns whitespace, punctuation, braces, and statement layout.',
} as const;

export const SWIFTLINT_ANALYZER: ReadonlySet<string> = new Set([
    'capture_variable',
    'typesafe_array_init',
    'unused_import',
]);

export const SWIFTLINT_OPT_IN: ReadonlySet<string> = new Set([
    'missing_docs',
    'no_extension_access_modifier',
    'fatal_error_message',
    'first_where',
    'last_where',
    'empty_count',
    'empty_string',
    'contains_over_first_not_nil',
    'contains_over_filter_count',
    'contains_over_filter_is_empty',
    'contains_over_range_nil_comparison',
    'empty_collection_literal',
    'flatmap_over_map_reduce',
    'untyped_error_in_catch',
    'accessibility_label_for_image',
    'accessibility_trait_for_button',
    'private_swiftui_state',
    'prefer_self_in_static_references',
    'closure_body_length',
    'array_init',
    'sorted_first_last',
    'enum_case_associated_values_count',
    'switch_case_on_newline',
    'async_without_await',
    'fallthrough',
    'force_unwrapping',
    'function_default_parameter_at_end',
    'implicitly_unwrapped_optional',
    'joined_default_parameter',
    'legacy_multiple',
    'legacy_random',
    'literal_expression_end_indentation',
    'lower_acl_than_parent',
    'overridden_super_call',
    'prefer_zero_over_explicit_init',
    'private_action',
    'private_outlet',
    'prohibited_super_call',
    'raw_value_for_camel_cased_codable_enum',
    'reduce_into',
    'redundant_nil_coalescing',
    'static_operator',
    'toggle_bool',
    'trailing_closure',
    'unavailable_function',
    'unowned_variable_capture',
    'balanced_xctest_lifecycle',
    'empty_xctest_method',
    'final_test_case',
    'test_case_accessibility',
    'xct_specific_matcher',
    'unhandled_throwing_task',
    'discarded_notification_center_observer',
    'identical_operands',
    'return_value_from_void_function',
    'weak_delegate',
    'superfluous_else',
    'optional_enum_case_matching',
    'self_binding',
    'local_doc_comment',
    'period_spacing',
    'prefer_self_type_over_type_of_self',
    'unneeded_override',
    'no_magic_numbers',
    'type_contents_order',
    'file_types_order',
    'no_empty_block',
    'explicit_acl',
    'private_over_fileprivate',
    'file_name_no_space',
    'discouraged_optional_boolean',
    'discouraged_optional_collection',
]);

export const SWIFTLINT_LEVEL_NOTE = ' Off at this level.';
