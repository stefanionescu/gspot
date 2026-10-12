export const SWIFT_EXTENSION = '.swift';

export const SWIFT_IMPORT_NODE = 'import_declaration';

export const SWIFT_IDENTIFIER_NODE = 'identifier';

export const SWIFT_ATTRIBUTE_NODE = 'attribute';

export const SWIFT_TYPE_NODE = 'user_type';

export const SWIFT_CALL_NODE = 'call_expression';

export const SWIFT_TEST_MODULES = ['XCTest', 'Testing'] as const;

export const SWIFT_TEST_ATTRIBUTES = ['Test', 'Suite', 'Testing.Test', 'Testing.Suite'] as const;

export const SWIFT_TEST_TARGET_CALLS = ['.testTarget', 'Target.testTarget'] as const;

export const SWIFT_IMPORT_TAG = 'swift-import:';

export const SWIFT_TEST_TARGET_TAG = 'swift-test-target';
