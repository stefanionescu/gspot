// A reused command session must read the corrected source in its next run.
export const SOURCE_EDITS = [
    {
        language: 'swift',
        path: 'Source.swift',
        sample: 'func readSourceEntriesFromFilesNow() -> Int { 1 }\n',
        corrected: String.raw`func readLines(_ source: String) -> [String] {
    let trimmed = source.trimmingCharacters(in: .whitespaces)
    let lines = trimmed.components(separatedBy: "\n")
    return lines
}
`,
    },
    {
        language: 'bash',
        path: 'source.sh',
        sample: 'BadName() { echo ready; }\n',
        corrected: String.raw`read_lines() {
    local source="$1"
    printf "%s\n" "$source"
    printf "%s\n" "Complete"
}
`,
    },
] as const;

export const HEADERS_FILE = `/*
    X-Content-Type-Options: nosniff
    Referrer-Policy: same-origin
    X-Frame-Options: DENY
`;

export const SCOPE_FINDINGS = [
    {
        check: 'supabase/service-role-key',
        root: [],
        nested: [{ file: 'apps/backend/client.ts', rule: 'admin-key' }],
    },
    {
        check: 'translations/messages',
        root: [],
        nested: [{ file: 'apps/backend/messages/de.json' }],
    },
    {
        check: 'cloudflare/security-headers',
        root: [],
        nested: [
            { file: 'apps/backend/_headers', rule: 'missing-header' },
            { file: 'apps/backend/_headers', rule: 'missing-header' },
        ],
    },
    {
        check: 'site/unused-assets',
        root: [{ file: 'assets/unused.png', rule: 'dead-asset' }],
        nested: [],
    },
] as const;
