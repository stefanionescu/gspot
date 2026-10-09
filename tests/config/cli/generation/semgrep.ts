export const SWIFT_IGNORE_FOLDERS = ['.build/', 'DerivedData/', 'Pods/'];

export const IGNORE_CASES = [
    {
        name: 'identical scope ignores reuse the root file',
        configurations: ['bash'],
        tables: '[scope.first]\n[scope.second]\n',
        sources: { 'sample.sh': 'echo sample\n' },
        paths: ['.semgrepignore'],
        swift: false,
        patterns: [],
    },
    {
        name: 'custom scope ignores retain the relative pattern',
        configurations: ['bash'],
        tables: '[scope.child]\n[[ignore]]\ncheck = "security/semgrep"\npaths = ["child/legacy/**"]\nreason = "Reviewed legacy scripts are maintained separately."\n',
        sources: { 'sample.sh': 'echo sample\n', 'child/legacy/script.sh': 'echo legacy\n' },
        paths: ['.semgrepignore', 'child/.semgrepignore'],
        swift: false,
        patterns: [{ path: 'child/.semgrepignore', text: 'legacy/**' }],
    },
    {
        name: 'Swift selection adds its ignored build folders',
        configurations: ['swift'],
        tables: '',
        sources: { 'example.swift': 'let value = 1\n' },
        paths: ['.semgrepignore'],
        swift: true,
        patterns: [],
    },
];
