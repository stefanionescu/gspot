// expo doctor
export const FAILED_DOCTOR_OUTPUT = `Running 15 checks on your project...
\u{1B}[32m✔\u{1B}[39m Check package.json for common issues
\u{1B}[31m✖\u{1B}[39m Check that packages match versions required by installed Expo SDK
\u{1B}[33mThe following packages should be updated for best compatibility with the installed expo version:\u{1B}[39m
\u{1B}[33m  react-native@0.81.4 - expected version: 0.81.5\u{1B}[39m
\u{1B}[32mAdvice:\u{1B}[39m
\u{1B}[32mUse 'npx expo install --check' to review and upgrade your dependencies.\u{1B}[39m

✖ Check for app config fields that may not be synced in a non-CNG project
This project contains native project folders but also has native configuration properties in app.json.

13/15 checks passed. 2 checks failed. Possible issues detected:
Use the --verbose flag to see more details about passed checks.`;

// nextjs checks
export const AUTHORED_NEXT_ENV = '// Authored type declaration\n';
export const GENERATED_ROUTES = '// Generated routes\n';
export const ROUTE_TYPES_COMMENT = '// Retained route types\n';

// purgecss
export const PURGECSS_STYLE_CASES = [
    {
        name: 'owned stylesheet',
        source: { 'theme.css': '.unused { color: red; }' },
        css: '.unused{color:red}',
        expected: ['.unused'],
    },
    { name: 'framework stylesheet', source: {}, css: '.framework{color:red}', expected: [] },
    { name: 'framework scoping marker', source: {}, css: '.svelte-abc{color:red}', expected: [] },
    {
        name: 'minified selector',
        source: { 'theme.scss': '.banner > .label { color: red; }' },
        css: '.banner>.label{color:red}',
        expected: ['.banner>.label'],
    },
    {
        name: 'Astro class scoping',
        source: { 'Page.astro': '<style>.unused { color: red; }</style>' },
        css: '.unused:where(.astro-abc){color:red}',
        expected: ['.unused:where(.astro-abc)'],
    },
    {
        name: 'Astro attribute scoping',
        source: { 'Page.astro': '<style>.unused { color: red; }</style>' },
        css: '.unused[data-astro-cid-abc]{color:red}',
        expected: ['.unused[data-astro-cid-abc]'],
    },
    {
        name: 'Svelte scoping',
        source: { 'Page.svelte': '<style>.unused { color: red; }</style>' },
        css: '.unused.svelte-abc{color:red}',
        expected: ['.unused.svelte-abc'],
    },
    {
        name: 'component text outside styles',
        source: { 'Page.vue': '<script>const text = ".unused{color:red}";</script>' },
        css: '.unused{color:red}',
        expected: [],
    },
] as const;

// sitemap
export const INVALID_SITEMAP_URLS = ['/', 'https://example.test/%E0%A4/'];

// svelte checks
export const SVELTE_CHECK_FINDINGS = [
    {
        file: 'src/Count.svelte',
        line: 2,
        column: 11,
        rule: 'TS2322',
        message: "Type 'string' is not assignable to type 'number'.",
    },
    {
        file: 'src/Product.svelte',
        line: 5,
        column: 1,
        rule: 'a11y_missing_attribute',
        message: '`<img>` element should have an alt attribute',
    },
] as const;
export const SVELTE_CHECK_OUTPUT = `1758823456789 START "/repo"
1758823456790 {"type":"ERROR","filename":"src/Count.svelte","start":{"line":1,"character":10},"end":{"line":1,"character":15},"message":"Type 'string' is not assignable to type 'number'.","code":2322,"source":"ts"}
1758823456791 {"type":"WARNING","filename":"src/Product.svelte","start":{"line":4,"character":0},"end":{"line":4,"character":20},"message":"\`<img>\` element should have an alt attribute","code":"a11y_missing_attribute","source":"svelte"}
1758823456792 COMPLETED 2 FILES 1 ERRORS 1 WARNINGS 2 FILES_WITH_PROBLEMS`;
export const SVELTE_PROJECTS = [
    {
        name: 'root JavaScript',
        scope: '',
        configurations: ['svelte'],
        files: {},
        extends: null,
        include: ['Component.svelte'],
    },
    {
        name: 'scoped TypeScript',
        scope: 'app',
        configurations: ['svelte', 'typescript'],
        files: {
            'app/tsconfig.json': JSON.stringify({ compilerOptions: { strict: true }, include: ['Component.svelte'] }),
        },
        extends: 'app/tsconfig.json',
        include: null,
    },
] as const;

// unused assets
export const GLOB_ASSET_CASES = [
    {
        path: 'docs/pages/index.astro',
        text: "---\nconst images = import.meta.glob<ImageMetadata>('../assets/tools/*.svg', { eager: true, import: 'default' });\n---\n<img src={images[icon].src} />",
        unused: ['docs/assets/other.svg'],
    },
    {
        path: 'docs/pages/icons.ts',
        text: "const images = import.meta.glob(['/assets/tools/*.svg', '!/assets/tools/spare.svg']);",
        unused: ['docs/assets/other.svg', 'docs/assets/tools/spare.svg'],
    },
    {
        path: 'docs/pages/icons.vue',
        text: "<script setup>const images = import.meta.glob('../assets/tools/*.svg');</script>",
        unused: ['docs/assets/other.svg'],
    },
    {
        path: 'docs/pages/example.ts',
        text: "// import.meta.glob('../assets/tools/*.svg')\nconst example = \"import.meta.glob('../assets/tools/*.svg')\";",
        unused: ['docs/assets/other.svg', 'docs/assets/tools/logo.svg', 'docs/assets/tools/spare.svg'],
    },
] as const;
