export const PYTHON_SOURCE = { 'source.py': 'VALUE = 1\n' };
export const TOOL_ONLY_PACKAGE = '{"private":true,"devDependencies":{"prettier":"3.8.1"}}\n';

/** Empty and named language lists both keep the common checks. */
export const CONFIGURATION_CHOICES = [
    { configurations: undefined },
    { configurations: undefined, noConfigurations: true },
    { configurations: ['python'] },
] as const;
export const VUE_COMPONENT = `<script setup>
const name = 1;
</script>
<template><p>{{ name }}</p></template>
`;

/** A Supabase project with an iOS package. */
export const PLATFORM_PROJECT_FILES = {
    'package.json': '{"name":"app","private":true,"type":"module"}\n',
    'supabase/config.toml': 'project_id = "example"\n',
    'ios/Package.swift': `// swift-tools-version:6.0
import PackageDescription
let package = Package(name: "App")
`,
    'ios/Sources/App/App.swift': 'let answer = 42\n',
    'tools/lint/package.json': '{"name":"lint","private":true,"devDependencies":{"eslint":"9.39.5"}}\n',
} as const;

/** A tsconfig and a stylesheet in src. */
export const STYLE_SOURCE_FILES = {
    'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src"]}\n',
    'src/styles.css': `p {
    color: #abc;
}
`,
} as const;

/** A JavaScript root with a Python API. */
export const MIXED_LANGUAGE_FILES = {
    'package.json': '{"name":"example","private":true,"type":"module"}\n',
    'source.js': 'export const port = 8080;\n',
    'api/pyproject.toml': `[project]
name = "api"
version = "1.0.0"
`,
    'api/source.py': 'PORT = 8080\n',
} as const;

/** Next.js configuration lists that win over locale dependency detection. */
export const NEXTJS_LOCALE_CASES = [
    { dependency: false, named: false, isSelected: false },
    { dependency: true, named: false, isSelected: false },
    { dependency: false, named: true, isSelected: true },
] as const;
