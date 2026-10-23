export const SCOPE_LIMITS = [
    { scope: '', characters: 38, functions: 37, words: 4 },
    { scope: 'app', characters: 36, functions: 35, words: 3 },
    { scope: 'sibling', characters: 38, functions: 37, words: 4 },
] as const;

export const SWIFT_NAMING_LIMITS = `[naming.swift]
max_characters = 38
max_words = 4
[naming.swift.functions]
max_characters = 37
[[scope]]
path = "app"
[scope.naming.swift]
max_characters = 36
max_words = 3
[scope.naming.swift.functions]
max_characters = 35
[[scope]]
path = "sibling"
`;

export const NAME_WORD_CASES = [
    ['HTMLParser', ['html', 'parser']],
    ['user_id', ['user', 'id']],
    ['parseHttpUrl', ['parse', 'http', 'url']],
    ['edge-case.test', ['edge', 'case', 'test']],
    ['handlerV2', ['handler', 'v', '2']],
    ['user2', ['user', '2']],
    ['decodeBase64', ['decode', 'base64']],
    ['s3Client', ['s3', 'client']],
    ['I18N', ['i18n']],
    ['sha256_user', ['sha256', 'user']],
] as const;
