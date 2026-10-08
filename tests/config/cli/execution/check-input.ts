// A reused command session must read the corrected source in its next run.
export const SOURCE_CORRECTIONS = [
    {
        language: 'swift',
        path: 'Source.swift',
        structural: 'structure/trivial-functions',
        sample: 'func readSourceEntriesFromFilesNow() -> Int { 1 }\n',
        corrected:
            'func readLines(_ source: String) -> [String] {\n    let trimmed = source.trimmingCharacters(in: .whitespaces)\n    let lines = trimmed.components(separatedBy: "\\n")\n    return lines\n}\n',
    },
    {
        language: 'bash',
        path: 'source.sh',
        structural: 'structure/trivial-functions',
        sample: 'BadName() { echo ready; }\n',
        corrected:
            'read_lines() {\n    local source="$1"\n    printf "%s\\n" "$source"\n    printf "%s\\n" "Complete"\n}\n',
    },
];
