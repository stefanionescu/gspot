export const CONFIGURATIONS = [
    'typescript',
    'javascript',
    'react',
    'nextjs',
    'css',
    'html',
    'markdown',
    'prose',
    'spelling',
    'commits',
    'files',
    'naming',
    'format',
    'docs',
    'secrets',
    'dependencies',
    'licenses',
];

export const SDK_DESTINATIONS = [
    { sdk: 'iphoneos', destination: 'generic/platform=iOS Simulator' },
    { sdk: 'iphonesimulator', destination: 'generic/platform=iOS Simulator' },
    { sdk: 'macosx', destination: 'platform=macOS' },
    { sdk: 'watchos', destination: 'generic/platform=watchOS Simulator' },
    { sdk: 'watchsimulator', destination: 'generic/platform=watchOS Simulator' },
    { sdk: 'xros', destination: 'generic/platform=visionOS Simulator' },
    { sdk: 'xrsimulator', destination: 'generic/platform=visionOS Simulator' },
];

export const MANUAL_SWIFT_CHOICES = [
    { name: 'disabled project', swift: { xcode_project: '' }, destination: 'generic/platform=iOS Simulator' },
    { name: 'selected project', swift: { xcode_project: 'Chosen.xcodeproj' }, destination: 'platform=macOS' },
    { name: 'empty destination', swift: { xcode_project: 'Chosen.xcodeproj', xcode_destination: '' }, destination: '' },
    {
        name: 'manual destination',
        swift: { xcode_project: 'Chosen.xcodeproj', xcode_destination: 'custom destination' },
        destination: 'custom destination',
    },
];

export const FORMAT_CASES = [
    {
        name: 'no formatter configuration',
        files: {},
        expected: { indent_width: 4, print_width: 120, quotes: 'single' },
    },
    {
        name: 'Prettier dependency without configuration',
        files: { 'package.json': '{"devDependencies":{"prettier":"3.8.1"}}' },
        expected: { indent_width: 2, print_width: 80, quotes: 'double' },
    },
    {
        name: 'partial Prettier JSON configuration',
        files: { '.prettierrc.json': '{"tabWidth":3}' },
        expected: { indent_width: 3, print_width: 80, quotes: 'double' },
    },
    {
        name: 'Prettier package configuration',
        files: { 'package.json': '{"prettier":{"tabWidth":6,"printWidth":100,"singleQuote":true}}' },
        expected: { indent_width: 6, print_width: 100, quotes: 'single' },
    },
    {
        name: 'Prettier JavaScript configuration',
        files: { 'prettier.config.mjs': 'export default { tabWidth: 3, printWidth: 90, singleQuote: false };' },
        expected: { indent_width: 3, print_width: 90, quotes: 'double' },
    },
    {
        name: 'EditorConfig without indent_style',
        files: { '.editorconfig': 'root = true\n[*]\nindent_size = 3\nmax_line_length = 96\n' },
        expected: { indent_width: 3, print_width: 96, quotes: 'single' },
    },
    {
        name: 'Prettier precedence over EditorConfig',
        files: {
            '.prettierrc.json': '{"singleQuote":true}',
            '.editorconfig': 'root = true\n[*]\nindent_size = 6\nmax_line_length = 96\n',
        },
        expected: { indent_width: 2, print_width: 80, quotes: 'single' },
    },
    {
        name: 'declared Prettier defaults before EditorConfig',
        files: {
            'package.json': '{"devDependencies":{"prettier":"3.8.1"}}',
            '.editorconfig': 'root = true\n[*]\nindent_size = 6\nmax_line_length = 96\n',
        },
        expected: { indent_width: 2, print_width: 80, quotes: 'double' },
    },
];

export const SCOPE_FORMAT_FILES = {
    '.prettierrc.json': '{"tabWidth":2,"printWidth":90,"singleQuote":false}',
    'app/.prettierrc.json': '{"tabWidth":6,"printWidth":100,"singleQuote":true}',
    'app/source.js': 'export const app = 1;\n',
    'app/deep/source.js': 'export const deep = 1;\n',
    'sibling/source.js': 'export const sibling = 1;\n',
};

export const FORMAT_REFUSALS = [
    { name: 'malformed JSON', text: '{"tabWidth":', message: 'JSON' },
    { name: 'invalid native option', text: '{"singleQuote":"invalid"}', message: 'singleQuote' },
];

export const SCOPE_FORMAT_CASES = [
    {
        name: 'repository configuration',
        template: '',
        expected: [
            ['', 2, 90, 'double'],
            ['app', 6, 100, 'single'],
            ['app/deep', 6, 100, 'single'],
            ['sibling', 2, 90, 'double'],
        ],
    },
    {
        name: 'template precedence',
        template: '[format]\nprint_width = 70\nquotes = "double"\n',
        expected: [
            ['', 2, 70, 'double'],
            ['app', 6, 70, 'double'],
            ['app/deep', 6, 70, 'double'],
            ['sibling', 2, 70, 'double'],
        ],
    },
];
