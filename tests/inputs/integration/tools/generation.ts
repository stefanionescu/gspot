// The literal values integration/tools/generation reads: names, patterns, limits, and tables.

export const SWIFT_DOCS_SOURCE =
    '/** Parses a fixture value. */\npublic func parsed(_ value: String) -> Int {\n    Int(value) ?? 0\n}\n\n/// The literal /** example */ is documentation syntax.\npublic let example = "/** not documentation */"\n\n/* Ordinary comment with a nested /** comment */ inside. */\n';
export const DEFECT = 'public func parsed(_ value: String) -> Int {\n    Int(value)! + 42\n}\n';
export const CORRECT =
    '/// Parses a fixture value.\npublic func parsed(_ value: String) -> Int {\n    Int(value) ?? 0\n}\n';
export const SCRIPTS = 'eval(code);\nexecSync(`build ${input}`);\n';
export const PLIST =
    '<plist><dict><key>NSAppTransportSecurity</key><dict><key>NSAllowsArbitraryLoads</key><true/></dict></dict></plist>\n';
export const SWIFT_SECURITY_FINDINGS = [
    { rule: 'ios-keychain-accessible-always', path: 'Value.swift', line: 1, level: 'recommended' },
    { rule: 'ios-no-secrets-in-userdefaults', path: 'Value.swift', line: 2, level: 'recommended' },
    { rule: 'ios-no-secrets-in-plist', path: 'Value.swift', line: 3, level: 'recommended' },
    { rule: 'ios-hardcoded-api-key', path: 'Value.swift', line: 4, level: 'recommended' },
    { rule: 'ios-hardcoded-url-with-credentials', path: 'Value.swift', line: 5, level: 'recommended' },
    { rule: 'ios-insecure-http-url', path: 'Value.swift', line: 6, level: 'recommended' },
    { rule: 'ios-unsafe-pointer-cast', path: 'Value.swift', line: 7, level: 'all' },
    { rule: 'ios-weak-hash-algorithm', path: 'Value.swift', line: 8, level: 'recommended' },
    { rule: 'ios-no-uiwebview', path: 'Value.swift', line: 9, level: 'recommended' },
    { rule: 'ios-wkwebview-javascript-enabled', path: 'Value.swift', line: 10, level: 'all' },
    { rule: 'ios-log-sensitive-data', path: 'Value.swift', line: 11, level: 'recommended' },
    { rule: 'ios-no-ats-exception-in-plist', path: 'Info.plist', line: 1, level: 'recommended' },
    { rule: 'ios-scripts-no-eval', path: 'scripts/build.js', line: 1, level: 'recommended' },
    { rule: 'ios-scripts-no-unquoted-shell-var-in-exec', path: 'scripts/build.js', line: 2, level: 'recommended' },
];

export const SWIFT_SECURITY_ARGS = [
    'scan',
    '--config',
    '.gspot/config/semgrep/ios.yml',
    '--metrics',
    'off',
    '--disable-version-check',
    '--no-rewrite-rule-ids',
    '--error',
    '--json',
    'Value.swift',
    'scripts/build.js',
    'Info.plist',
];

export const SWIFT_INLINE_DOCS = [
    '/// A choice.',
    'public enum Choice {',
    '    /// The first choice.',
    '    case one /** Inline documentation. */',
    '}',
    '/// A literal.',
    'public let example = "/** literal */" /** After a string. */',
    '/* Ordinary comment. */ /** After a comment. */',
    '/// An inline /** example */ remains documentation.',
    'public let value = "safe"',
    '/* Ordinary /** nested */ comment. */',
    '// swiftlint:disable:next doc_comment_style - An external declaration retains its layout.',
    '/** A retained declaration. */',
    'public let preserved = "fixed"',
    '',
].join('\n');

export const JAVASCRIPT_AUTHORED_FILES = {
    'jsconfig.json': '{"extends":"./base.json"}\n',
    'base.json': JSON.stringify({
        compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'Bundler',
            baseUrl: '.',
            paths: { '@shape/*': ['source/*'] },
            types: ['domain'],
            incremental: true,
            tsBuildInfoFile: 'authored/cache.tsbuildinfo',
        },
        include: ['source/**/*.js'],
        exclude: ['excluded'],
    }),
    'excluded/source.js': 'UnknownDependency();\n',
};
