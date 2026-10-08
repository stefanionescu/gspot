/** Separate project files exercise parser observation and scope isolation. */
export const SWIFT_SOURCES = {
    'app/Order.swift': 'func total() -> Int { return 1 }\nlet callback = { value in value + 1 }\n',
    'worker/Order.swift': 'func deliver() { first(); second(); third() }\n',
    'generated/Order.swift': 'func generated() -> Int { return 0 }\n',
    'app/readme.md': '# App\n',
};
