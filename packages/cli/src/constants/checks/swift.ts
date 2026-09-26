// The literal values checks/swift reads: names, patterns, limits, and tables.

export const SWIFTLINT_COMMAND = [
    'swiftlint',
    'lint',
    '--strict',
    '--quiet',
    '--no-cache',
    '--reporter',
    'json',
    '{files}',
];
export const DOC_RULE = 'doc_comment_style';
export const DEFAULT_DUPLICATE_LINES = 4;
export const DECLARATIONS = new Set([
    'class_declaration',
    'protocol_declaration',
    'function_declaration',
    'property_declaration',
    'typealias_declaration',
]);
export const FILE_LOCAL = new Set(['private', 'fileprivate']);
export const ENVIRONMENT_READ = 'ProcessInfo.processInfo.environment';
export const DEFAULT_DESTINATION = 'generic/platform=iOS Simulator';
export const WORKSPACE_SUFFIX = '.xcworkspace';
export const DIAGNOSTIC = /^(?<file>\/[^:]+):(?<line>\d+):(?<column>\d+): (?<level>error|warning): (?<text>.*)$/u;
export const RESPONSE_FILE = /@(?<path>\/\S+)/gu;
export const PRIVATE_PREFIX = /(?<before>^|[\s=])\/private\/(?<folder>tmp|var)\//gu;
export const RULE_SUFFIX = /^(?<text>.*\S)\s+\((?<rule>[a-z_]+)\)$/u;
