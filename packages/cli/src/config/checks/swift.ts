// The literal values the checks of swift, xcode, xctest read: names, patterns, limits, and tables.

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
export const COMMENTS = new Set(['comment', 'multiline_comment']);
/** A comment that directs a tool rather than a reader, which must sit on the line it covers. */
export const DIRECTIVE = /^\/[/*]\s*(?:swiftlint:|swiftformat:|periphery:|sourcery:)/u;
export const ENVIRONMENT_READ = 'ProcessInfo.processInfo.environment';
export const DEFAULT_DESTINATION = 'generic/platform=iOS Simulator';
export const WORKSPACE_SUFFIX = '.xcworkspace';
export const DIAGNOSTIC = /^(?<file>\/[^:]+):(?<line>\d+):(?<column>\d+): (?<level>error|warning): (?<text>.*)$/u;
export const RESPONSE_FILE = /@(?<path>\/\S+)/gu;
export const PRIVATE_PREFIX = /(?<before>^|[\s=])\/private\/(?<folder>tmp|var)\//gu;
export const RULE_SUFFIX = /^(?<text>.*\S)\s+\((?<rule>[a-z_]+)\)$/u;

export const XCODE_PROJECT_FILE = '.xcodeproj/project.pbxproj';
export const PBXPROJ_ESCAPES: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' };
export const PBXPROJ_PUNCTUATION = new Set(['{', '}', '(', ')', '=', ';', ',']);
export const SYMLINK_MODE = '120000';
export const WORD_CHARACTER = /[A-Za-z0-9_.$/+-]/u;
export const BUILD_SETTING = /\$[({]/u;
export const SETTING_NAME = /^[A-Za-z_][\w.[\]=*,-]*$/u;
export const INCLUDE_LINE = /^#include\??\s+"[^"]+"$/u;
export const PLIST_KEY = /<key>(?<name>[^<]+)<\/key>/gu;
export const ARBITRARY_LOADS = /<key>NSAllowsArbitraryLoads<\/key>\s*<true\s*\/>/u;
export const NOT_WORD = /[^A-Za-z\d]/u;
export const IMAGE_SET = '.imageset/Contents.json';
export const NAMED_SETS = ['.imageset/Contents.json', '.colorset/Contents.json'];

export const SWIFT_COMMENT_LINE = /^\s*\/\/\s*\S{3,}/u;
export const SLEEP_CALLS = new Set([
    'sleep',
    'usleep',
    'Darwin.sleep',
    'Darwin.usleep',
    'Glibc.sleep',
    'Glibc.usleep',
    'Thread.sleep',
    'Task.sleep',
]);
export const PERCENT = 100;
