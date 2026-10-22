export const MACOS_PRIVATE_PATH = /(?<before>^|[\s=])\/private\/(?<folder>tmp|var)\//gu;

export const MACOS_PRIVATE_REPLACEMENT = '$<before>/$<folder>/';

export const MESSAGE_LINE =
    /^(?<file>(?:[A-Za-z]:)?[\\/][^\r\n]+?):(?<line>\d+):(?<column>\d+): (?<level>error|warning): (?<text>.*)$/u;

export const RULE_SUFFIX = /^(?<text>.*\S)\s+\((?<rule>[a-z_]+)\)$/u;

export const RESPONSE_FILE = /@(?<path>(?:[A-Za-z]:)?[\\/]\S+)/gu;

export const BUILD_LEVELS: ReadonlySet<string> = new Set(['error']);

/** The name of the config file that the Swift build checks pass to SwiftLint. */
export const SWIFTLINT_CONFIG_NAME = 'swiftlint';

export const SWIFTLINT_ANALYZE_COMMAND = ['swiftlint', 'analyze', '--strict', '--quiet'] as const;

export const SWIFTLINT_CONFIG_FLAG = '--config';

export const COMPILER_LOG_FLAG = '--compiler-log-path';

export const REPORTED_LEVELS: ReadonlySet<string> = new Set(['error', 'warning']);

/** The config file name that the Swift build checks pass to Periphery. */
export const PERIPHERY_CONFIG_FILE = 'periphery';

export const PERIPHERY_COMMAND = [
    'periphery',
    'scan',
    '--strict',
    '--quiet',
    '--format',
    'xcode',
    '--disable-update-check',
    '--config',
] as const;

export const SWIFTLINT_CONFIG_FILE = '.swiftlint.yml';
