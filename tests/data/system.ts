/** External inputs stop at the settings or file access check. */
export const LINKED_FILE_CASES = [
    {
        path: 'gspot.toml',
        outside: 'configurations = []\n',
        files: {},
        message: 'gspot.toml is not a regular file with one link. Use a regular file without extra hard links.',
    },
    {
        path: '.gspot/version',
        outside: '0.0.1\n',
        files: { 'project/gspot.toml': 'configurations = []\n' },
        message: '.gspot/version is not a regular file with one link. Use a regular file without extra hard links.',
    },
] as const;

export const BASH_MANIFEST = '[configuration]\nname = "bash"\n';

export const PACKAGE_FOLDER = 'workspace % café';

export const ASSET_READER_SCRIPT = `import { readFileSync } from 'node:fs';
import { listAssets, buildAssetPath } from './packages/cli/src/system/assets.ts';
const text = readFileSync(buildAssetPath('configurations/language/bash/manifest.toml'), 'utf8');
console.log(JSON.stringify({ text, files: listAssets('configurations') }));
`;

// Authored markers in every malformed layout, in both supported file formats.
export const BLOCK_FORMATS = [
    {
        path: 'AGENTS.md',
        style: 'markdown',
        start: '<!-- >>> gspot managed >>> -->',
        end: '<!-- <<< gspot managed <<< -->',
    },
    { path: '.gitignore', style: 'hash', start: '# >>> gspot managed >>>', end: '# <<< gspot managed <<<' },
] as const;

export const MALFORMED_BLOCKS = [
    { path: 'AGENTS.md', style: 'markdown', source: '<!-- >>> gspot managed >>> -->\nbody\n' },
    { path: 'AGENTS.md', style: 'markdown', source: 'body\n<!-- <<< gspot managed <<< -->\n' },
    {
        path: 'AGENTS.md',
        style: 'markdown',
        source: `<!-- <<< gspot managed <<< -->
body
<!-- >>> gspot managed >>> -->
`,
    },
    {
        path: 'AGENTS.md',
        style: 'markdown',
        source: `<!-- >>> gspot managed >>> -->
<!-- >>> gspot managed >>> -->
body
<!-- <<< gspot managed <<< -->
`,
    },
    {
        path: 'AGENTS.md',
        style: 'markdown',
        source: `<!-- >>> gspot managed >>> -->
body
<!-- <<< gspot managed <<< -->
<!-- <<< gspot managed <<< -->
`,
    },
] as const;

export const MODE_REPLACEMENTS = [
    { original: 0o444, replacement: 0o644, content: 'replacement', posix: false },
    { original: 0o640, replacement: 0o444, content: 'replacement\n', posix: true },
] as const;

export const OUTSIDE_LINKS = [
    {
        path: 'escape/sentinel',
        refusal: 'A parent of escape/sentinel is a link or is not a directory. Choose a directory without links.',
    },
    {
        path: 'linked',
        refusal: 'linked is not a regular file with one link. Use a regular file without extra hard links.',
    },
    {
        path: 'hardlinked',
        refusal: 'hardlinked is not a regular file with one link. Use a regular file without extra hard links.',
    },
] as const;

export const OUTSIDE_PATTERNS = [
    '../outside/**',
    'src/../../outside.ts',
    '/etc/**',
    'C:/Windows/**',
    '!../outside/**',
    '{src,../outside}/**',
    'src/{..,nested}/*.ts',
] as const;

/** Repository-relative paths that a write refuses, and an ordinary Unicode name that it keeps. */
export const PORTABLE_PATHS = [
    { path: '../outside', refused: true },
    { path: '/outside', refused: true },
    { path: 'a/../b', refused: true },
    { path: 'a//b', refused: true },
    { path: 'a/./b', refused: true },
    { path: 'C:relative', refused: true },
    { path: 'C:/absolute', refused: true },
    { path: String.raw`\\server\share`, refused: true },
    { path: String.raw`a\b`, refused: true },
    { path: 'nul.txt', refused: true },
    { path: 'a/COM1', refused: true },
    { path: 'a.', refused: true },
    { path: 'a ', refused: true },
    { path: 'a\0b', refused: true },
    { path: '', refused: true },
    { path: 'documents/équipe 50%.md', refused: false },
] as const;

export const PACKAGE_FOLDER_FILES = {
    'packages/cli/configurations/.index.json': '{}',
    'packages/cli/configurations/language/bash/.meta/state.json': '{}',
} as const;

export const LINKED_MISE_FOLDERS = [
    { link: '.config', target: '../outside', pattern: '.config/sub/*.toml' },
    { link: '.config/sub', target: '../../outside/sub', pattern: '.config/sub/*.toml' },
    { link: '.config', target: '../outside', pattern: '.config/sub/tool.toml' },
] as const;

/** Files for the glob include and exclude tests. */
export const GLOB_FILES = {
    'src/a.ts': '',
    'src/.leaf.ts': '',
    'src/Case.TS': '',
    'src/nested/.inner/b.ts': '',
    '.hidden/nested/c.ts': '',
    'node_modules/.hidden/foreign.ts': '',
} as const;

/** Source and external settings for linked mise folder checks. */
export const LINKED_MISE_FILES = {
    'project/source.ts': 'export {};\n',
    'outside/sub/tool.toml': 'setting = "external"\n',
} as const;
