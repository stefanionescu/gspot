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

export const LOG_FUNCTIONS: ReadonlySet<string> = new Set(['print', 'NSLog', 'os_log']);

export const LOG_METHODS: ReadonlySet<string> = new Set([
    'trace',
    'debug',
    'info',
    'notice',
    'warning',
    'warn',
    'error',
    'fault',
    'critical',
    'log',
]);

export const SECRET_WORD = /token|password|secret|credential/iu;

export const SECRET_VALUE = /^(?:[a-z_]\w*\.)*\w*(?:token|password|secret|credential)\w*$/iu;

export const SECRET_PLIST_KEY = /Secret|Password|PrivateKey/u;

export const PRIVACY_LABEL = 'privacy';

export const PUBLIC_PRIVACY = '.public';

export const USER_DEFAULTS_RECEIVER = /^UserDefaults\b/u;

export const USER_DEFAULTS_DECLARATION = /\b(\w+)\s*[:=]\s*UserDefaults\b/gu;

export const PLIST_READ_EXPRESSION = /^Bundle\.main\.(?:infoDictionary\??|object)$/u;

export const SWIFT_SECURITY_RULES = {
    keychain: 'keychain-accessible-always',
    weakHash: 'weak-hash-algorithm',
    log: 'secret-in-log',
    defaults: 'secret-in-userdefaults',
    plist: 'secret-in-plist',
    sqlInterpolation: 'sql-interpolation',
};

const WEAK_HASH = {
    rule: SWIFT_SECURITY_RULES.weakHash,
    message: 'MD5 and SHA-1 are broken. Use SHA-256 or stronger from CryptoKit.',
};

export const UNSAFE_SWIFT_NAMES: ReadonlyMap<string, { rule: string; message: string }> = new Map([
    [
        'kSecAttrAccessibleAlways',
        {
            rule: SWIFT_SECURITY_RULES.keychain,
            message: 'This Keychain class opens the item on a locked device. Choose the class the item needs.',
        },
    ],
    ['Insecure.MD5', WEAK_HASH],
    ['Insecure.SHA1', WEAK_HASH],
    ['CC_MD5', WEAK_HASH],
    ['CC_SHA1', WEAK_HASH],
]);

export const SWIFT_SECRET_FINDINGS = {
    log: {
        rule: SWIFT_SECURITY_RULES.log,
        message: 'The log may write a token, password, or credential. Redact it.',
    },
    defaults: {
        rule: SWIFT_SECURITY_RULES.defaults,
        message: 'UserDefaults stores this secret unencrypted. Keep it in the Keychain.',
    },
    plist: {
        rule: SWIFT_SECURITY_RULES.plist,
        message: 'Info.plist ships this secret unencrypted in the app. Read it from the Keychain.',
    },
};

export const MACOS_PRIVATE_PATH = /(?<before>^|[\s=])\/private\/(?<folder>tmp|var)\//gu;

export const MESSAGE_LINE =
    /^(?<file>(?:[A-Za-z]:)?[\\/][^\r\n]+?):(?<line>\d+):(?<column>\d+): (?<level>error|warning): (?<text>.*)$/u;

export const RULE_SUFFIX = /^(?<text>.*\S)\s+\((?<rule>[a-z_]+)\)$/u;

export const RESPONSE_FILE = /@(?<path>(?:[A-Za-z]:)?[\\/]\S+)/gu;

export const BUILD_LEVELS: ReadonlySet<string> = new Set(['error']);

export const REPORTED_LEVELS: ReadonlySet<string> = new Set(['error', 'warning']);

export const WARNING_LEVELS: ReadonlySet<string> = new Set(['warning']);

export const XCODE_WARNINGS_MARKER = 'warnings';

export const COMPILER_RULE = 'compiler';

export const SWIFT_BUILD_NAME = 'Swift build';

export const SWIFTC_CALL = 'swiftc ';

export const SWIFT_BUILD_FOLDER = 'swift';

export const ROOT_BUILD_FOLDER = 'root';

export const SCOPE_FOLDER_PREFIX = 'scope-';

export const BUILD_LOG = 'build.log';

export const PACKAGE_SCRATCH_FOLDER = 'package';

export const SWIFT_PROGRAM = 'swift';

export const SWIFT_BUILD_COMMANDS = {
    package: [
        'build',
        '--build-tests',
        '--enable-code-coverage',
        '--enable-index-store',
        '--force-resolved-versions',
        '-Xswiftc',
        '-warnings-as-errors',
        '-v',
    ],
    xcode: [
        'build-for-testing',
        '-enableCodeCoverage',
        'YES',
        '-onlyUsePackageVersionsFromResolvedFile',
        '-disableAutomaticPackageResolution',
    ],
} as const;

export const XCODE_CLEAN_ACTION = 'clean';

export const SWIFT_TEST_COMMAND = ['test', '--skip-build', '--enable-code-coverage'] as const;

export const XCODE_TEST_ACTION = 'test-without-building';

export const PACKAGE_INDEX_STORE = 'debug/index/store';

export const XCODE_INDEX_STORE = 'Index.noindex/DataStore';

export const BUILD_LOCK = 'build.lock';

export const BUILD_LOCK_WAIT_MILLISECONDS = 250;

export const FAILED_BUILD_NOTE = 'The Swift build failed; swift/build reports it.';

export const XCODE_WORKSPACE_SUFFIX = '.xcworkspace';

export const XCODE_WORKSPACE_FLAG = '-workspace';

export const XCODE_PROJECT_FLAG = '-project';

export const XCODEBUILD_PROGRAM = 'xcodebuild';

export const XCODE_SCHEME_FLAG = '-scheme';

export const XCODE_DESTINATION_FLAG = '-destination';

export const DERIVED_DATA_FLAG = '-derivedDataPath';

export const DERIVED_DATA_FOLDER = 'derived';

export const CODE_SIGNING_OFF = 'CODE_SIGNING_ALLOWED=NO';

export const BUILD_SOURCE_FOLDER = 'source';

export const SCRATCH_PATH_FLAG = '--scratch-path';

export const NO_SWIFT_PROJECT_NOTE = 'Set swift.xcode_project or add Package.swift in this scope.';

export const XCODE_SCHEME_MESSAGE = 'Set swift.xcode_scheme for the configured Xcode project.';

export const SWIFT_CODECOV_COMMAND = ['swift', 'test', '--show-codecov-path'] as const;

export const SWIFT_DESCRIBE_COMMAND = ['swift', 'package', 'describe', '--type', 'json'] as const;

export const COVERAGE_BUNDLE = 'coverage.xcresult';

export const XCODE_COVERAGE_FLAGS = ['-enableCodeCoverage', 'YES', '-resultBundlePath'] as const;

export const XCCOV_COMMAND = ['xcrun', 'xccov', 'view', '--report', '--json'] as const;

export const APP_TARGET_SUFFIX = '.app';

export const TEST_TARGET_TYPE = 'test';

export const SWIFT_TARGET_MODULE = 'SwiftTarget';

export const SWIFT_TEST_NAME = 'swift test';

export const SWIFT_PACKAGE_NAME = 'swift package';

export const COVERAGE_RULE = 'coverage';

export const SWIFT_TESTS_MESSAGE = 'Swift tests failed';

export const MISSING_COVERAGE_MESSAGE = 'Swift produced no UTF-8 coverage report at its reported path.';

export const TEST_RUNNER_MESSAGE = 'The test runner printed no error output.';

export const XCTEST_FAILURE_LINE = /^(?<file>.+?):(?<line>\d+): error: -\[.+?\] : (?<message>.+)$/u;

export const SWIFT_TESTING_FAILURE_LINE =
    /Test .+? recorded an issue at (?<file>.+?):(?<line>\d+):(?<column>\d+): (?<message>.+)$/u;

export const FAILED_TEST_RULE = 'failed-test';

export const PERIPHERY_TOOL = 'periphery';

export const PERIPHERY_COMMAND = [
    'periphery',
    'scan',
    '--skip-build',
    '--strict',
    '--quiet',
    '--format',
    'xcode',
    '--disable-update-check',
    '--config',
] as const;

export const PERIPHERY_INDEX_STORE_FLAG = '--index-store-path';

export const UNUSED_RULE = 'unused';

export const SWIFT_STRING_LITERAL = /^(#*)("""|")([\s\S]*)\2\1$/u;

export const XCTEST_PREFIX = /^XCTest\./u;

export const SKIP_REASON_ARGUMENT = new Map([
    ['XCTSkip', 0],
    ['XCTSkipIf', 1],
    ['XCTSkipUnless', 1],
    ['.enabled', 0],
    ['ConditionTrait.enabled', 0],
    ['Testing.ConditionTrait.enabled', 0],
    ['.disabled', 0],
    ['ConditionTrait.disabled', 0],
    ['Testing.ConditionTrait.disabled', 0],
]);

export const COMMENT_LINE = /^\s*\/\/\s*\S{3,}/u;

export const REASON_GROUP_INDEX = 3;

export const DISABLED_TEST_RULE = 'disabled';

export const DISABLED_TEST_MESSAGE =
    'Explain why this test is disabled in its reason argument or availability annotation.';

export const SWIFTLINT_TOOL = 'swiftlint';

export const SWIFTLINT_ANALYZE_COMMAND = ['swiftlint', 'analyze', '--strict', '--quiet'] as const;

export const SWIFTLINT_CONFIG_FLAG = '--config';

export const COMPILER_LOG_FLAG = '--compiler-log-path';

export const ANALYZER_RULE = 'analyzer';
