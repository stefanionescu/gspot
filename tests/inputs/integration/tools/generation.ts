// The literal values integration/tools/generation reads: names, patterns, limits, and tables.

export const SWIFT_DOCS_SOURCE =
    '/** Parses a fixture value. */\npublic func parsed(_ value: String) -> Int {\n    Int(value) ?? 0\n}\n\n/// The literal /** example */ is documentation syntax.\npublic let example = "/** not documentation */"\n\n/* Ordinary comment with a nested /** comment */ inside. */\n';
export const DEFECT = 'public func parsed(_ value: String) -> Int {\n    Int(value)! + 42\n}\n';
export const CORRECT =
    '/// Parses a fixture value.\npublic func parsed(_ value: String) -> Int {\n    Int(value) ?? 0\n}\n';
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
