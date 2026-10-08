import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';
import { CAST_SWIFT, CLEAN_SWIFT } from '#tests/config/samples/swift/source.ts';

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
        files: {},
        expected: { file: 'Sources/App/Greeting.swift', rule: 'consecutiveSpaces', line: 4 },
    },
];

export const REPOSITORY: RepositoryScenario = {
    configurations: ['swift', 'naming'],
    modules: false,

    tools: ['swiftlint', 'swiftformat'],
    files: { 'Sources/App/Greeting.swift': CLEAN_SWIFT },
};
