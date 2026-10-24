export const FRAMEWORK_NAMES = [
    { configuration: 'nextjs', name: 'getServerSideProps', bannedWords: ['get server side props'] },
    { configuration: 'react', name: 'useSyncExternalStore', bannedWords: ['use sync external store'] },
] as const;

export const TEST_PATH_SETTINGS = `level = "all"
configurations = ["javascript", "swift", "naming"]
test_files = ["qa/**"]
[[scope]]
path = "apps/web"
test_files = ["apps/web/verification/**"]
[[scope]]
path = "apps/api"
`;

export const TEST_PATH_FILES = {
    'qa/entry.js': 'export const testcaseCount = 1;\n',
    'tests/default.js': 'export const testcaseCount = 1;\n',
    'src/entry.js': 'export const testcaseCount = 1;\n',
    'Tests/Service.swift': 'let testcaseCount = 1\n',
    'Sources/ServiceTests.swift': 'let testcaseCount = 1\n',
    'Sources/Service.swift': 'let testcaseCount = 1\n',
    'apps/web/verification/entry.js': 'export const testcaseCount = 1;\n',
    'apps/web/qa/entry.js': 'export const testcaseCount = 1;\n',
    'apps/web/src/entry.js': 'export const testcaseCount = 1;\n',
    'apps/api/verification/entry.js': 'export const testcaseCount = 1;\n',
} as const;

export const REACT_COMPONENT_SOURCE = [
    "import { createContext, memo } from 'react';",
    "import styled from 'styled-components';",
    'export const CartContext = createContext(null);',
    'export const Row = memo(() => null);',
    'export const Title = styled.h1`font-weight: bold;`;',
    'export const BadValue = readValue();',
    'const { user_name, account: bad_account } = payload;',
    'export const names = [user_name, bad_account];',
    '',
] as const;

export const PYTHON_TYPE_SOURCE = [
    'from typing import Literal, Optional, TypeAlias',
    'Mode = Literal["read", "write"]',
    'ModeChoice = Optional[Mode] | None',
    'Reading: TypeAlias = "Reader"',
    '_Private = dict[str, int]',
    'READ_FLAG = 1',
    'ACCESS_FLAGS = READ_FLAG | 2',
    'class Reader:',
    '    def __init_subclass__(cls):',
    '        pass',
    '    def __rich_repr__(self):',
    '        pass',
    'badAlias = Literal["x"]',
    '',
] as const;

export const TEST_FILE_FINDINGS = [
    { file: 'Sources/Service.swift', rule: 'banned-word' },
    { file: 'Sources/ServiceTests.swift', rule: 'banned-word' },
    { file: 'src/entry.js', rule: 'banned-word' },
    { file: 'tests/Service.swift', rule: 'banned-word' },
    { file: 'tests/default.js', rule: 'banned-word' },
    { file: 'apps/api/verification/entry.js', rule: 'banned-word' },
    { file: 'apps/web/qa/entry.js', rule: 'banned-word' },
    { file: 'apps/web/src/entry.js', rule: 'banned-word' },
] as const;
