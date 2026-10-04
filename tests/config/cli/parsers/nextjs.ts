export const NEXT_CONFIG_CASES = [
    {
        name: 'keys after a nested env value',
        source: `export default {\n  env: {\n    NESTED: { API_TOKEN: "nested text" },\n    "API_SECRET": process.env.API_SECRET,\n    ["PASSWORD"]: process.env.PASSWORD,\n    TOKEN,\n  },\n  typescript: { ["ignoreBuildErrors"]: (true as const) },\n};\n`,
        expected: [
            { name: 'API_SECRET', line: 4, kind: 'env-secret' },
            { name: 'PASSWORD', line: 5, kind: 'env-secret' },
            { name: 'TOKEN', line: 6, kind: 'env-secret' },
            { name: 'ignoreBuildErrors', line: 8, kind: 'checks-off' },
        ],
    },
    {
        name: 'quoted and asserted literal disabled checks',
        source: `export default {\n  eslint: { "ignoreDuringBuilds": true satisfies boolean },\n  typescript: { ignoreBuildErrors: <boolean>true },\n};\n`,
        expected: [
            { name: 'ignoreDuringBuilds', line: 2, kind: 'checks-off' },
            { name: 'ignoreBuildErrors', line: 3, kind: 'checks-off' },
        ],
    },
    {
        name: 'comments, strings, false flags, and nested env values',
        source: `// env: { API_SECRET: "comment" }\nconst text = "ignoreBuildErrors: true";\nexport default {\n  env: { SETTINGS: { API_TOKEN: text }, PUBLIC_ENDPOINT: "https://example.com" },\n  eslint: { ignoreDuringBuilds: false },\n  typescript: { ignoreBuildErrors: enabled },\n};\n`,
        expected: [],
    },
] as const;
