export const TOOL_ONLY_PACKAGE = '{"private":true,"devDependencies":{"prettier":"3.8.1"}}\n';

export const CONFIGURATION_CHOICES = [
    {
        configurations: undefined,
        expected: [
            'javascript',
            'commits',
            'data-files',
            'dependencies',
            'docs',
            'duplication',
            'engineering',
            'format',
            'gspot',
            'licenses',
            'naming',
            'prose',
            'repository',
            'secrets',
            'security',
            'spelling',
            'structure',
        ],
    },
    {
        configurations: undefined,
        noConfigurations: true,
        expected: [
            'commits',
            'data-files',
            'dependencies',
            'docs',
            'duplication',
            'engineering',
            'format',
            'gspot',
            'licenses',
            'naming',
            'prose',
            'repository',
            'secrets',
            'security',
            'spelling',
            'structure',
        ],
    },
    {
        configurations: ['python'],
        expected: [
            'python',
            'commits',
            'data-files',
            'dependencies',
            'docs',
            'duplication',
            'engineering',
            'format',
            'gspot',
            'licenses',
            'naming',
            'prose',
            'repository',
            'secrets',
            'security',
            'spelling',
            'structure',
        ],
    },
] as const;

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

export const STYLE_SOURCE_FILES = {
    'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src"]}\n',
    'src/styles.css': `p {
    color: #abc;
}
`,
} as const;

export const NEXTJS_LOCALE_CASES = [
    { dependency: false, named: false, isSelected: false },
    { dependency: true, named: false, isSelected: false },
    { dependency: false, named: true, isSelected: true },
] as const;
