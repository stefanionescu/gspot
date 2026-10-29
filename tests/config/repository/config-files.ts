export const INI_HEADING_CASES = [
    ['too long', '[sqlfluffbox]\nvalue = 3\n'],
    ['incomplete', '[sqlfluff\nvalue = 3\n'],
] as const;

export const CONFLICT_FILES = {
    '.toolrc': '{}',
    'nested/.toolrc': '{}',
    'tool.config': '{}',
    'nested/tool.config': '{}',
    'app/package.json': '{"name":"app"}',
    'app/tool.config': '{}',
    'shared.json': '{"first":{},"second":{}}',
    'root.config': '{}',
    'ignored.untracked': '{}',
};

export const CONFLICT_REPLACEMENTS = ['.toolrc', 'tool.config', 'root.config', '*.untracked'];

export const ORDERED_CONFLICTS = [
    { tool: 'first', path: '.toolrc', shared: false },
    { tool: 'first', path: 'nested/.toolrc', shared: false },
    { tool: 'first', path: 'tool.config', shared: false },
    { tool: 'first', path: 'app/tool.config', shared: false },
    { tool: 'first', path: 'root.config', shared: false },
    { tool: 'first', path: 'shared.json', shared: true, key: 'first' },
    { tool: 'first', path: 'shared.json', shared: true, key: 'second' },
    { tool: 'second', path: '.toolrc', shared: false },
    { tool: 'second', path: 'nested/.toolrc', shared: false },
];
