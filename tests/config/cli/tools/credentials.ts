export const REGISTRY_PASSWORDS = [
    ['https://example.com/simple', []],
    ['https://alex@example.com/simple', []],
    ['https://alex:test%2Bpassword@example.com/simple', ['test%2Bpassword', 'test+password']],
    ['https://alex:password@example.com/simple', ['password', 'password']],
] as const;

export const LEAKED_LOCKS = [
    'password = "synthetic/password+with spaces"',
    'url = "https://alex:synthetic%2Fpassword%2Bwith%20spaces@example.com/simple"',
] as const;
