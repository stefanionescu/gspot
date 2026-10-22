export const SCOPE_LIMITS = [
    { scope: '', characters: 38, functions: 37, words: 4 },
    { scope: 'app', characters: 36, functions: 35, words: 3 },
    { scope: 'sibling', characters: 38, functions: 37, words: 4 },
] as const;

export const SWIFT_NAMING_LIMITS =
    `[naming.swift]
max_characters = 38
max_words = 4
[naming.swift.functions]
max_characters = 37
` +
    `[[scope]]
path = "app"
[scope.naming.swift]
max_characters = 36
max_words = 3
` +
    `[scope.naming.swift.functions]
max_characters = 35
[[scope]]
path = "sibling"
`;
