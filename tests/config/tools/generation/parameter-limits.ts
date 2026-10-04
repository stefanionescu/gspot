/** Native source, command, and fixed failure status for each parameter-limit tool. */
export const PARAMETER_CASES = [
    {
        language: 'python',
        file: 'example.py',
        configName: '.gspot/config/ruff.toml',
        command: ['ruff', 'check', '--config', '.gspot/config/ruff.toml', '--output-format', 'json', 'example.py'],
        source: `"""Parameter-limit fixtures."""


def _seven(value0: int, value1: int, value2: int, value3: int, value4: int, value5: int, value6: int) -> int:
    return value0 + value1 + value2 + value3 + value4 + value5 + value6


def _eight(
    value0: int,
    value1: int,
    value2: int,
    value3: int,
    value4: int,
    value5: int,
    value6: int,
    value7: int,
) -> int:
    return value0 + value1 + value2 + value3 + value4 + value5 + value6 + value7
`,
        finding: { code: 'PLR0913', location: { row: 8 } },
        failureStatus: 1,
    },
    {
        language: 'swift',
        file: 'example.swift',
        configName: '.gspot/config/swiftlint.yml',
        command: [
            'swiftlint',
            'lint',
            '--config',
            '.gspot/config/swiftlint.yml',
            '--reporter',
            'json',
            '--quiet',
            '--no-cache',
            'example.swift',
        ],
        source: `internal func seven(
    value0: Int = 0,
    value1: Int = 0,
    value2: Int = 0,
    value3: Int = 0,
    value4: Int = 0,
    value5: Int = 0,
    value6: Int = 0
) -> Int {
    return value0 + value1 + value2 + value3 + value4 + value5 + value6
}

internal func eight(
    value0: Int = 0,
    value1: Int = 0,
    value2: Int = 0,
    value3: Int = 0,
    value4: Int = 0,
    value5: Int = 0,
    value6: Int = 0,
    value7: Int = 0
) -> Int {
    return value0 + value1 + value2 + value3 + value4 + value5 + value6 + value7
}
`,
        finding: { rule_id: 'function_parameter_count', line: 13 },
        failureStatus: 2,
    },
];
