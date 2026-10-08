export const FILE_LOCAL = new Set(['private', 'fileprivate']);

export const ENVIRONMENT_READ = 'ProcessInfo.processInfo.environment';

export const WORKSPACE_SUFFIX = '.xcworkspace';

export const DIAGNOSTIC =
    /^(?<file>(?:[A-Za-z]:)?[/\\][^\r\n]+?):(?<line>\d+):(?<column>\d+): (?<level>error|warning): (?<text>.*)$/u;

export const RESPONSE_FILE = /@(?<path>(?:[A-Za-z]:[\\/]|[\\/])\S+)/gu;

export const MACOS_PRIVATE_PATH = /(?<before>^|[\s=])\/private\/(?<folder>tmp|var)\//gu;

export const RULE_SUFFIX = /^(?<text>.*\S)\s+\((?<rule>[a-z_]+)\)$/u;

/** A comment that directs a tool rather than a reader, which must sit on the line it covers. */
export const DIRECTIVE = /^\/[/*]\s*(?:swiftlint:|swiftformat:|periphery:|sourcery:)/u;

/** Selected source copies shared by the compiler, analyzer, Periphery, and coverage. */
export const BUILD_SOURCE_DIRECTORY = 'source';

/** Native package operations for each independent Swift consumer. */
export const PACKAGE_COMMANDS = {
    compile: ['build', '-v'],
    analyze: ['build', '-v'],
    periphery: ['build', '-v'],
    coverage: ['test', '--enable-code-coverage'],
};

/** Native Xcode operations for each independent Swift consumer. */
export const XCODE_COMMANDS = {
    compile: ['build-for-testing'],
    analyze: ['clean', 'build-for-testing'],
    periphery: ['build-for-testing'],
    coverage: ['test'],
};
