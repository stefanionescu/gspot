import testsPackage from '#tests/package.json';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { REACT_NATIVE_DEPENDENCIES } from '#tests/config/generation/samples.ts';

export const SERVER_FILES = {
    'gspot.toml': buildSandboxSettings(['javascript'], {
        level: 'all',
        rules: true,
        scopes: [{ path: 'app', configurations: ['nextjs'] }],
    }),
    'app/lib/widget/server.js': 'export const value = 1;\n',
    'app/lib/widget/data.server.js': 'export const value = 1;\n',
    'app/server/data.js': 'export const value = 1;\n',
} as const;

export const COMPONENT_FILES = {
    'Card.vue': '<template><p>{{ count }}</p></template>\n<script setup lang="ts">const count: number = 1;</script>\n',
    'Card.svelte': '<script lang="ts">const count: number = 1;</script>\n<p>{count}</p>\n',
    'Card.astro': '---\nconst count: number = 1;\n---\n<p>{count}</p>\n',
    'source.ts': 'export const count: number = 1;\n',
    'source.js': 'export const count = 1;\n',
} as const;

export const HTML_INJECTION_CASES = [
    {
        configuration: 'react',
        path: 'src/Greeting.jsx',
        rule: '@eslint-react/dom-no-dangerously-set-innerhtml',
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

export const MOBILE_FILES: Record<string, string> = {
    ...MOBILE_SOURCE_FILES,
    'bare/package.json': JSON.stringify({
        private: true,
        dependencies: { react: testsPackage.devDependencies.react, ...REACT_NATIVE_DEPENDENCIES },
    }),
    'expo-app/package.json': JSON.stringify({
        private: true,
        dependencies: { react: testsPackage.devDependencies.react, ...REACT_NATIVE_DEPENDENCIES, expo: '54.0.0' },
    }),
};

export const NEXTJS_ROUTE_PROJECTS = {
    'gspot.toml': buildSandboxSettings(['javascript'], {
        level: 'all',
        scopes: [
            { path: 'apps/first', configurations: ['nextjs'] },
            { path: 'apps/second', configurations: ['nextjs'] },
            { path: 'apps/empty', configurations: ['nextjs'] },
        ],
    }),
    'package.json': '{"private":true,"type":"module"}\n',
    'apps/first/pages/about.jsx': 'export default function About() { return <p>About</p>; }\n',
    'apps/first/pages/index.jsx': 'export default function Home() { return <a href="/about">About</a>; }\n',
    'apps/second/src/pages/about.jsx': 'export default function About() { return <p>About</p>; }\n',
    'apps/second/src/pages/index.jsx': 'export default function Home() { return <a href="/about">About</a>; }\n',
    'apps/empty/component.jsx': 'export function Empty() { return <p>Empty</p>; }\n',
};
