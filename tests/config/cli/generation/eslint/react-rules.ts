const COMPONENT_HEADER = "// A test component.\nimport type { ReactNode } from 'react';\n\n";

export const WEB_FILES = {
    'src/Names.tsx':
        COMPONENT_HEADER +
        '/**\n * Lists names.\n * @param props the names\n * @param props.names the names\n * @returns the list\n */\nexport function Names({ names }: Readonly<{ names: string[] }>): ReactNode {\n    return <ul>{names.map((name) => <li>{name}</li>)}</ul>;\n}\n',
    'src/Raw.tsx':
        COMPONENT_HEADER +
        '/**\n * Shows markup it was handed.\n * @param props the markup\n * @param props.html the markup\n * @returns the element\n */\nexport function Raw({ html }: Readonly<{ html: string }>): ReactNode {\n    return <div dangerouslySetInnerHTML={{ __html: html }} />;\n}\n',
    'src/Picture.tsx':
        COMPONENT_HEADER +
        '/**\n * Shows a picture.\n * @returns the picture\n */\nexport function Picture(): ReactNode {\n    return <img src="picture.png" />;\n}\n',
    'src/Badge.tsx':
        COMPONENT_HEADER +
        '/** The size of a badge. */\nexport const badgeSize = 2;\n\n/**\n * Shows a badge.\n * @returns the badge\n */\nexport function Badge(): ReactNode {\n    return <span>{badgeSize}</span>;\n}\n',
    'src/Gap.tsx':
        COMPONENT_HEADER +
        '/**\n * Leaves a gap.\n * @returns the gap\n */\nexport function Gap(): ReactNode {\n    return <div></div>;\n}\n',
};

export const WEB_EXPECTED = [
    { rule: 'react/jsx-key', file: 'src/Names.tsx', line: 11 },
    { rule: 'react/no-danger', file: 'src/Raw.tsx', line: 11 },
    { rule: 'jsx-a11y/alt-text', file: 'src/Picture.tsx', line: 9 },
    { rule: 'react-refresh/only-export-components', file: 'src/Badge.tsx', line: 5 },
];

export const NATIVE_FILES = {
    'src/address.ts': `// A test file.\n\nconst { EXPO_PUBLIC_URL } = process.env;\n\n/** Where the service lives. */\nexport const address = EXPO_PUBLIC_URL;\n`,
    'src/Rows.tsx': `// A test file.\n\n/**\n * Lists rows.\n * @returns the list\n */\nexport function Rows(): unknown {\n    return <FlatList data={[]} renderItem={undefined} />;\n}\n`,
    'src/session.ts': `// A test file.\n\n/**\n * Keeps the session.\n * @param value the session\n * @returns when it is kept\n */\nexport async function keep(value: string): Promise<void> {\n    await AsyncStorage.setItem('auth_token', value);\n}\n`,
    'src/frame.ts': `// A test file.\n\nimport View from 'react-native/Libraries/Components/View/View';\n\n/** The view each screen draws in. */\nexport const Frame = View;\n`,
    'src/Label.tsx': `// A test file.\n\n/**\n * Labels a row.\n * @returns the label\n */\nexport function Label(): unknown {\n    return <View>label</View>;\n}\n`,
};

export const NATIVE_EXPECTED = [
    { rule: 'expo/no-env-var-destructuring', file: 'src/address.ts', line: 3 },
    { rule: 'no-restricted-syntax', file: 'src/Rows.tsx', line: 8 },
    { rule: 'no-restricted-syntax', file: 'src/session.ts', line: 9 },
    { rule: '@react-native/no-deep-imports', file: 'src/frame.ts', line: 3 },
    { rule: 'react-native/no-raw-text', file: 'src/Label.tsx', line: 8 },
];
