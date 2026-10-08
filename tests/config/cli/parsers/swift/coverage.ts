export const SWIFT_PACKAGE_COVERAGE_TARGETS = [
    {
        name: 'Core',
        path: 'Custom/Core',
        type: 'library',
        module_type: 'SwiftTarget',
        sources: ['First.swift', 'Second.swift'],
    },
    { name: 'API', path: 'Sources/API', type: 'library', module_type: 'SwiftTarget', sources: ['API.swift'] },
    {
        name: 'CoreTests',
        path: 'Tests/CoreTests',
        type: 'test',
        module_type: 'SwiftTarget',
        sources: ['CoreTests.swift'],
    },
    { name: 'Native', path: 'Sources/Native', type: 'library', module_type: 'ClangTarget', sources: ['native.c'] },
];

export const SWIFT_PACKAGE_COVERAGE_FILES = [
    { filename: 'Custom/Core/First.swift', summary: { lines: { count: 3, covered: 1 } } },
    { filename: 'Custom/Core/Second.swift', summary: { lines: { count: 1, covered: 1 } } },
    { filename: 'Sources/API/API.swift', summary: { lines: { count: 3, covered: 2 } } },
    { filename: 'Tests/CoreTests/CoreTests.swift', summary: { lines: { count: 2, covered: 2 } } },
];
