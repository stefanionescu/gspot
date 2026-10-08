/** The tool runtime follows applicable npm checks, independently of the repository's language runtime. */
export const NODE_REQUIREMENTS = [
    {
        name: 'Python with native mise tools',
        runner: 'mise',
        configurations: ['python'],
        files: { 'app.py': 'value = 1\n', 'pyproject.toml': '[project]\nname = "app"\nversion = "1.0.0"\n' },
        node: false,
    },
    {
        name: 'Python with the npm EditorConfig wrapper',
        runner: 'npm',
        configurations: ['python'],
        files: { 'app.py': 'value = 1\n', 'pyproject.toml': '[project]\nname = "app"\nversion = "1.0.0"\n' },
        node: true,
    },
    {
        name: 'Python with Markdown',
        runner: 'mise',
        configurations: ['python', 'markdown'],
        files: { 'app.py': 'value = 1\n', 'guide.md': '# Guide\n' },
        node: true,
    },
    {
        name: 'Bun with TypeScript',
        runner: 'mise',
        configurations: ['typescript'],
        files: {
            'app.ts': 'export const value = 1;\n',
            'package.json': '{"private":true,"engines":{"bun":"1.4.2"}}\n',
        },
        node: true,
    },
];
