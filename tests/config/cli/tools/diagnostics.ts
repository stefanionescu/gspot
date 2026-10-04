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
