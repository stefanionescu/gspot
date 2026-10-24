export const LOCAL_FILE_PATHS = {
    indexOnly: ['.env.'],
    refused: [
        '.env',
        '.env.local',
        '.env.example.local',
        'nested/.dev.vars.production',
        'node_modules/.env.example',
        'bower_components/package/index.js',
        'python/.venv/lib/package.py',
        'python/nested/venv/lib/package.py',
        'python/deep/.venv/lib/package.py',
        'swift/Pods/Library/source.swift',
        'swift/DerivedData/output.bin',
        'swift/.build/output.bin',
        'sibling/node_modules/package/index.js',
        'sibling/.dev.vars',
    ],
    allowed: [
        '.env.example',
        '.env.template',
        '.env.sample',
        '.dev.vars.example',
        'nested/.env.example',
        'nested/.env.template',
        'nested/.env.sample',
        'nested/.dev.vars.example',
        'python/node_modules/package/index.js',
        'swift/node_modules/package/index.js',
        'sibling/.venv/lib/package.py',
        '.venv/lib/package.py',
        '.build/output.bin',
        'python/source.py',
    ],
    scopes: `[[scope]]
path = "python"
configurations = ["python"]
removed_configurations = { value = ["javascript"], reason = "This scope uses its own language tools without JavaScript dependencies." }
[[scope]]
path = "python/deep"
[[scope]]
path = "swift"
configurations = ["swift"]
removed_configurations = { value = ["javascript"], reason = "This scope uses its own language tools without JavaScript dependencies." }
[[scope]]
path = "sibling"
`,
} as const;

export const LARGE_FILE_TABLES = `[[scope]]
path = "app"

[repository]
max_file_kilobytes = 1
`;
