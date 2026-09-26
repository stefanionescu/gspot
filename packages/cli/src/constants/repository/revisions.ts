// The literal values repository/revisions reads: names, patterns, limits, and tables.

export const PARSE_TIMEOUT_MS = 30_000;
export const EDITABLE_FINDER = /^(?:__editable__.*_finder|_editable_impl_.+)\.py$/u;
// Parse installed loader metadata without importing it or processing site packages.
export const PYTHON_EDITABLE_PATHS = `import ast, json, sys
source = sys.stdin.read()
lines = source.encode("utf-8").splitlines(keepends=True)
paths = []
def add_path(entry):
    if not isinstance(entry, ast.Constant) or not isinstance(entry.value, str):
        raise ValueError("Editable paths must be literal strings")
    paths.append({"start": sum(map(len, lines[:entry.lineno - 1])) + entry.col_offset,
                  "end": sum(map(len, lines[:entry.end_lineno - 1])) + entry.end_col_offset,
                  "path": entry.value})
for statement in ast.parse(source).body:
    if isinstance(statement, ast.Expr) and isinstance(statement.value, ast.Call):
        call = statement.value
        if isinstance(call.func, ast.Attribute) and isinstance(call.func.value, ast.Name) and call.func.value.id == "F" and call.func.attr == "map_module":
            if len(call.args) != 2 or call.keywords:
                raise ValueError("Editable module mappings must have two literal arguments")
            add_path(call.args[1])
        continue
    if isinstance(statement, ast.AnnAssign):
        targets = [statement.target]
    elif isinstance(statement, ast.Assign):
        targets = statement.targets
    else:
        continue
    if not any(isinstance(target, ast.Name) and target.id in ("MAPPING", "NAMESPACES") for target in targets):
        continue
    value = statement.value
    if not isinstance(value, ast.Dict):
        raise ValueError("Editable path metadata must be a literal dictionary")
    ast.literal_eval(value)
    for item in value.values:
        entries = item.elts if isinstance(item, (ast.List, ast.Tuple)) else [item]
        for entry in entries:
            add_path(entry)
print(json.dumps(paths))
`;
export const MATERIALIZATION_BATCH_SIZE = 64;
export const NEWLINE = 10;
export const EXECUTABLE_MODE = 0o755;
export const FILE_MODE = 0o644;
export const LINK_MODE = 0o777;
export const ENTRY_MODES: Record<string, number> = {
    '100644': FILE_MODE,
    '100755': EXECUTABLE_MODE,
    '120000': LINK_MODE,
};
export const COPY_CONCURRENCY = 8;
export const LOCKS = ['package-lock.json', 'bun.lock', 'pnpm-lock.yaml', 'yarn.lock', 'uv.lock', 'Package.resolved'];
export const VALE_CONFIGURATION = '.gspot/config/vale.ini';
export const CHANGED_PATHS = ['diff', '--relative', '--name-only', '--no-renames', '-z'];
export const OBJECT_ID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
export const ABSENT_OBJECT = /^0+$/u;
export const DIFF_PATHS = ['diff', '--relative', '--no-ext-diff', '--name-only', '--no-renames', '-z'];
export const LOG_PATHS = [
    'log',
    '--relative',
    '--format=',
    '--name-only',
    '--no-renames',
    '--diff-merges=separate',
    '-z',
];
