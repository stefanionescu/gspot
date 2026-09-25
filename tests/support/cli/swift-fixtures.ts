// The planted Swift sources of the swift configuration tests and the init arguments they start from.
import { initArgs } from '#tests/support/cli/init.ts';

/** init selecting swift and naming without spelling. */
export const SWIFT_INIT = initArgs(['swift', 'naming'], ['spelling']);

/** A clean function that every Swift check accepts. */
export const CLEAN_SWIFT =
    'import Foundation\n\n/// Builds the greeting for a person.\npublic func greeting(for name: String) -> String {\n    let person = name.trimmingCharacters(in: .whitespacesAndNewlines)\n    if person.isEmpty {\n        return "hello"\n    }\n    return "hello \\(person)"\n}\n';

/** A force cast SwiftLint reports. */
export const CAST_SWIFT =
    'import Foundation\n\n/// Reads a value as text.\nfunc text(from value: Any) -> NSString {\n    value as! NSString\n}\n';
