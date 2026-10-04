export const TRIVIAL_FILES = [
    {
        name: 'a Python forwarding wrapper',
        language: 'python',
        source: 'from other import alias\ndef wrapper():\n    return alias()\n',
        expected: true,
    },
    {
        name: 'a Python implementation with three statements',
        language: 'python',
        source: 'def owner():\n    one()\n    two()\n    three()\n',
        expected: false,
    },
    {
        name: 'a Swift forwarding wrapper',
        language: 'swift',
        source: 'struct Wrapper { func value() { return original() } }',
        expected: true,
    },
    {
        name: 'a Swift implementation with three statements',
        language: 'swift',
        source: 'struct Owner { func value() { one(); two(); three() } }',
        expected: false,
    },
    {
        name: 'a Bash forwarding wrapper',
        language: 'bash',
        source: 'source ./other.sh\nwrapper() { original; }',
        expected: true,
    },
    {
        name: 'a Bash implementation with three statements',
        language: 'bash',
        source: 'owner() { one; two; three; }',
        expected: false,
    },
] as const;
