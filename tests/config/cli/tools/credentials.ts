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

/** Printed credential forms a failing package manager can expose. */
export const CREDENTIAL_DIAGNOSTICS = [
    {
        output: 'GET https://alex:unknown-password@registry.example.com/private-tool: 404',
        expected: 'GET https://[redacted]@registry.example.com/private-tool: 404',
    },
    { output: '_authToken="unknown token"', expected: '_authToken=[redacted]' },
    { output: 'password: unknown-password', expected: 'password: [redacted]' },
    { output: 'Authorization: Bearer unknown-token', expected: 'Authorization: [redacted]' },
    { output: 'Authorization: Basic dXNlcjpwYXNz', expected: 'Authorization: [redacted]' },
];
