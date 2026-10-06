import type { FindingCase } from '#tests/types/harness/check-case.ts';
import { CAST_SWIFT, CLEAN_SWIFT } from '#tests/config/samples/swift.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';

export const SPACED =
    'import Foundation\n\n/// Builds the greeting for a person.\npublic func   greeting(for name: String) -> String {\n    let person = name.trimmingCharacters(in: .whitespacesAndNewlines)\n    if person.isEmpty {\n        return "hello"\n    }\n    return "hello \\(person)"\n}\n';

export const CASES: FindingCase[] = [
    // SwiftLint has no Windows build.
    {
        check: 'swift/swiftlint',
        files: { 'Sources/App/Cast.swift': CAST_SWIFT },
        expected: { file: 'Sources/App/Cast.swift', rule: 'force_cast', line: 5 },
        platforms: ['darwin', 'linux'],
    },
    {
        check: 'swift/swiftformat',
        files: { 'Sources/App/Greeting.swift': SPACED },
        expected: { file: 'Sources/App/Greeting.swift', rule: 'consecutiveSpaces', line: 4 },
    },
];

/** Authored inputs and configuration selection for this scenario. */
export const REPOSITORY: RepositoryScenario = {
    configurations: ['swift', 'naming'],
    modules: false,

    tools: ['swiftlint', 'swiftformat'],
    files: { 'Sources/App/Greeting.swift': CLEAN_SWIFT },
};
