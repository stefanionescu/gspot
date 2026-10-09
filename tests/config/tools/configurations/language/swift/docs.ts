export const SWIFT_DOCS_SOURCE =
    '/** Parses a sample value. */\npublic func parsed(_ value: String) -> Int {\n    Int(value) ?? 0\n}\n\n/// The literal /** example */ is documentation syntax.\npublic let example = "/** not documentation */"\n\n/* Ordinary comment with a nested /** comment */ inside. */\n';

export const SWIFT_INLINE_DOCS =
    '/// A choice.\npublic enum Choice {\n    /// The first choice.\n    case one /** Inline documentation. */\n}\n/// A literal.\npublic let example = "/** literal */" /** After a string. */\n/* Ordinary comment. */ /** After a comment. */\n/// An inline /** example */ remains documentation.\npublic let value = "safe"\n/* Ordinary /** nested */ comment. */\n// swiftformat:disable:next blockComments - An external declaration retains its layout.\n/** A retained declaration. */\npublic let preserved = "fixed"\n';

export const SWIFT_FORMAT_CHECK = ['check', '--only', 'swift/swiftformat', '--json'];
