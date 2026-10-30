export const DEPTRY_SCOPE_PATHS = {
    '': {
        excluded: ['.gspot/tool.py', 'app/main.py', 'app/nested/main.py', 'other/main.py'],
        kept: ['main.py', 'application/main.py'],
    },
    app: { excluded: ['.gspot/tool.py', 'nested/main.py'], kept: ['main.py', 'nestedness/main.py'] },
    'app/nested': { excluded: ['.gspot/tool.py'], kept: ['main.py'] },
    other: { excluded: ['.gspot/tool.py'], kept: ['main.py'] },
} as const;
