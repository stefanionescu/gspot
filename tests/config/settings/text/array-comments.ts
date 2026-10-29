export const ARRAY_COMMENT_CASES = [
    {
        name: 'delete array items and free prose',
        source: '# Global note\n\n# Exclusions\ntest_files=[\n # Keep A\n "a/**", # A inline\n # Delete B\n "b/**", # B inline\n # Keep C\n "c/**"\n] # Array inline\n\n# Free prose\n\n[hooks]\nenabled=true\n',
        target: 'test_files = [ "a/**", "c/**" ]\n\n[hooks]\nenabled = true\n',
        expected:
            '# Global note\n\n# Exclusions\ntest_files=[\n # Keep A\n "a/**", # A inline\n # Keep C\n # Delete B\n# B inline\n"c/**"\n] # Array inline\n\n# Free prose\n\n[hooks]\nenabled=true\n',
    },
    {
        name: 'nested arrays',
        source: '[tools.eslint.rules]\nvalues=[\n # First group\n [\n # First number\n 1, # First inline\n 2\n ], # First group inline\n # Second group\n [\n # Last number\n 3\n ]\n]\n',
        expected:
            '[tools.eslint.rules]\nvalues=[\n # First group\n [\n # First number\n 1, # First inline\n 2\n ], # First group inline\n # Second group\n [\n # Last number\n 3\n ]\n]\n',
    },
    {
        name: 'mixed array',
        source: '[tools.eslint.rules]\nvalues=[\n # A table\n {a=[\n # Nested table number\n 1\n ]},\n # A scalar\n 2\n]\n',
        expected:
            '[tools.eslint.rules]\nvalues=[\n # A table\n {a=[\n # Nested table number\n 1\n ]},\n # A scalar\n 2\n]\n',
    },
];
