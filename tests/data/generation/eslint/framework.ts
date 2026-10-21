import { buildSandboxSettings } from '#tests/setup/settings.ts';

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
    'gspot.toml': buildSandboxSettings(['javascript'], {
        level: 'all',
        rules: true,
        scopes: [{ path: 'app', configurations: ['nextjs'] }],
    }),
    'app/lib/widget/server.js': 'export const value = 1;\n',
    'app/lib/widget/data.server.js': 'export const value = 1;\n',
    'app/server/data.js': 'export const value = 1;\n',
} as const;

/** Component sources for each framework parser. */
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

/** Literal interface text outside the test files, which the translation rule reports. */
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

/** React Native and Expo scopes that share no framework configuration. */
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

const MOBILE_SOURCE_FILES = {
    'gspot.toml': MOBILE_SETTINGS,
    'bare/source.js': 'const { EXPO_PUBLIC_URL } = process.env;\n',
    'expo-app/source.js': 'const { EXPO_PUBLIC_URL } = process.env;\n',
} as const;

export { I18N_SOURCE, SERVER_FILES, RAW_HTML_CASES, SELECTOR_FILES, COMPONENT_FILES, MOBILE_SOURCE_FILES };
