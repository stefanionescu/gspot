import type { ObservationCase } from '#tests/types/cli/parsers.ts';

export const TYPED_DECLARATION = 'const counter: number = 1;';

/** Separate project files exercise parser observation and scope isolation. */
export const PYTHON_SOURCES = {
    'api/order.py': 'def total():\n    return 1\n\ncallback = lambda value: value + 1\n',
    'worker/order.py': 'def deliver():\n    first()\n    second()\n    third()\n',
    'generated/order.py': 'def generated():\n    return 0\n',
    'api/readme.md': '# API\n',
};

/** Separate project files exercise parser observation and scope isolation. */
export const SWIFT_SOURCES = {
    'app/Order.swift': 'func total() -> Int { return 1 }\nlet callback = { value in value + 1 }\n',
    'worker/Order.swift': 'func deliver() { first(); second(); third() }\n',
    'generated/Order.swift': 'func generated() -> Int { return 0 }\n',
    'app/readme.md': '# App\n',
};

/** Native readers retain distinct source and function observations. */
export const PARSER_OBSERVATIONS: ObservationCase[] = [
    {
        language: 'Python',
        files: PYTHON_SOURCES,
        paths: ['api/order.py', 'worker/order.py', 'generated/order.py', 'api/readme.md'],
        functions: [
            { path: 'api/order.py', name: 'total' },
            { path: 'api/order.py', name: 'lambda' },
        ],
        names: ['total', 'lambda', 'deliver'],
    },
    {
        language: 'Swift',
        files: SWIFT_SOURCES,
        paths: ['app/Order.swift', 'worker/Order.swift', 'generated/Order.swift', 'app/readme.md'],
        functions: [
            { path: 'app/Order.swift', name: 'total' },
            { path: 'app/Order.swift', name: 'closure' },
        ],
        names: ['total', 'closure', 'deliver'],
    },
];
