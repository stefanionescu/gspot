import { EXPO_DEPENDENCIES } from '#tests/data/checks/react.ts';

const SELECTOR_FILES = {
    'native/App.jsx': `const list = <FlatList data={items} />;
const scroll = <ScrollView>{items.map(renderItem)}</ScrollView>;
`,
    'forms/Fields.jsx': `const checkbox = <input type="checkbox" value="a" {...register("choice")} />;
const radio = <input type="radio" value="a" {...register("choice")} />;
const text = <input type="text" value="a" {...register("choice")} />;
`,
} as const;

const SERVER_FILES = {
    'app/lib/widget/server.js': 'export const value = 1;\n',
    'app/lib/widget/data.server.js': 'export const value = 1;\n',
    'app/server/data.js': 'export const value = 1;\n',
} as const;

/** Real component and language sources used by their selected native parsers. */
const COMPONENT_FILES = {
    'Card.vue': '<template><p>{{ count }}</p></template>\n<script setup lang="ts">const count: number = 1;</script>\n',
    'Card.svelte': '<script lang="ts">const count: number = 1;</script>\n<p>{count}</p>\n',
    'Card.astro': `---
const count: number = 1;
---
<p>{count}</p>
`,
    'source.ts': 'export const count: number = 1;\n',
    'source.js': 'export const count = 1;\n',
} as const;

/** Translate literal interface text outside the declared test files. */
const I18N_SOURCE = 'export const element = <p>Hello there</p>;\n';

// Each framework exposes the same security finding through its own markup syntax.
const RAW_HTML_CASES = [
    {
        configuration: 'react',
        path: 'src/Greeting.jsx',
        rule: 'react/no-danger',
        sample: 'export const Greeting = () => <div dangerouslySetInnerHTML={{ __html: "<b>Hello</b>" }} />;\n',
        corrected: 'export const Greeting = () => <div>{"<b>Hello</b>"}</div>;\n',
    },
    {
        configuration: 'svelte',
        path: 'src/Greeting.svelte',
        rule: 'svelte/no-at-html-tags',
        sample: '<div>{@html "<b>Hello</b>"}</div>\n',
        corrected: '<div>{"<b>Hello</b>"}</div>\n',
    },
    {
        configuration: 'vue',
        path: 'src/Greeting.vue',
        rule: 'vue/no-v-html',
        sample: '<template><div v-html="markup"></div></template>\n',
        corrected: '<template><div>{{ markup }}</div></template>\n',
    },
    {
        configuration: 'astro',
        path: 'src/Greeting.astro',
        rule: 'astro/no-set-html-directive',
        sample: '<div set:html={"<b>Hello</b>"} />\n',
        corrected: '<div>{"<b>Hello</b>"}</div>\n',
    },
] as const;

/** Sources that distinguish native text components from raw text in a view. */
const TEXT_COMPONENTS = {
    'src/Label.jsx': 'export const Label = () => <ThemedText>label</ThemedText>;\n',
    'src/Raw.jsx': 'export const Raw = () => <View>label</View>;\n',
    'src/Native.jsx': 'export const Native = () => <Text>label</Text>;\n',
} as const;

/** Scoped React Native and Expo projects sharing no framework configuration. */
const MOBILE_SETTINGS = `configurations = [ "javascript" ]

[[scope]]
path = "bare"
configurations = [ "react-native" ]

[[scope]]
path = "expo-app"
configurations = [ "expo" ]

[rules]
enabled = false
`;

const REACT_NATIVE_FILES = {
    'src/Box.tsx': `// A test file.

/**
 * Draws a box.
 * @returns the box
 */
export function Box(): unknown {
    return <View style={{ padding: 8 }} />;
}
`,
} as const;

const REACT_NATIVE_FIXES = [
    {
        name: 'expo',
        configurations: ['typescript', 'react-native', 'expo'],
        dependencies: EXPO_DEPENDENCIES,
        file: 'src/Box.tsx',
        source: REACT_NATIVE_FILES['src/Box.tsx'],
        rule: 'react-native/no-inline-styles',
        line: 8,
    },
] as const;

const MOBILE_SOURCE_FILES = {
    'gspot.toml': MOBILE_SETTINGS,
    'bare/source.js': 'const { EXPO_PUBLIC_URL } = process.env;\n',
    'expo-app/source.js': 'const { EXPO_PUBLIC_URL } = process.env;\n',
} as const;

export {
    I18N_SOURCE,
    SERVER_FILES,
    RAW_HTML_CASES,
    SELECTOR_FILES,
    COMPONENT_FILES,
    TEXT_COMPONENTS,
    REACT_NATIVE_FIXES,
    MOBILE_SOURCE_FILES,
};
