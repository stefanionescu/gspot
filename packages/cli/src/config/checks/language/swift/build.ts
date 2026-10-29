export const MACOS_PRIVATE_PATH = /(?<before>^|[\s=])\/private\/(?<folder>tmp|var)\//gu;

export const MESSAGE_LINE =
    /^(?<file>(?:[A-Za-z]:)?[\\/][^\r\n]+?):(?<line>\d+):(?<column>\d+): (?<level>error|warning): (?<text>.*)$/u;

export const RULE_SUFFIX = /^(?<text>.*\S)\s+\((?<rule>[a-z_]+)\)$/u;

export const RESPONSE_FILE = /@(?<path>(?:[A-Za-z]:)?[\\/]\S+)/gu;

export const BUILD_LEVELS: ReadonlySet<string> = new Set(['error']);

export const REPORTED_LEVELS: ReadonlySet<string> = new Set(['error', 'warning']);

export const COMPILER_RULE = 'compiler';

export const SWIFT_BUILD_NAME = 'Swift build';

export const SWIFTC_CALL = 'swiftc ';
