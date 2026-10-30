export const BUILD_OUTPUT_CHECKS = [
    'site/html-validate',
    'site/purgecss',
    'site/lychee',
    'site/size',
    'site/sitemap',
] as const;

export const WORKSPACE_SITE_FILES = {
    'package.json': '{"private":true,"workspaces":["web","packages/*"]}',
    'web/package.json': '{"name":"web","type":"module","dependencies":{"core":"workspace:*"}}',
    'packages/core/package.json': '{"name":"core","type":"module","main":"value.js"}',
    'packages/core/value.js': 'export const value = "<h1>Workspace site</h1>";',
    'packages/unused/package.json': '{"name":"unused"}',
    'packages/unused/private.txt': 'Unrelated site bytes',
} as const;

export const BUILT_PAGE_CASES = [
    {
        check: 'site/size',
        files: {},
        settings: `[[site.size_limit]]
paths = ["dist/**/*.html"]
kilobytes = 0
`,
        expected: { file: 'gspot.toml', rule: 'size', line: 1 },
        corrected: {
            files: {},
            settings: `[[site.size_limit]]
paths = ["dist/**/*.html"]
kilobytes = 10
`,
        },
    },
    {
        check: 'site/sitemap',
        files: {
            'sitemap.xml': `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://example.test/</loc></url>
    <url><loc>https://example.test/about.html</loc></url>
    <url><loc>https://example.test/pricing.html</loc></url>
</urlset>
`,
        },
        expected: { file: 'dist/sitemap.xml', rule: 'missing-page', line: 1 },
    },
] as const;

export const INVALID_SITEMAP_URLS = ['/', 'https://example.test/%E0%A4/'];

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
        name: 'Vue scoping',
        source: { 'Page.vue': '<style scoped>.unused { color: red; }</style>' },
        css: '.unused[data-v-abc]{color:red}',
        expected: ['.unused[data-v-abc]'],
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
    {
        name: 'Tailwind classes',
        source: {
            'theme.css': String.raw`.w-\[13px\]{width:13px}.w-1\.5{width:0.375rem}.\!mt-0{margin-top:0}.md\:w-1\/2{width:50%}.banner{color:red}`,
        },
        css: String.raw`.w-\[13px\]{width:13px}.w-1\.5{width:0.375rem}.\!mt-0{margin-top:0}.md\:w-1\/2{width:50%}.banner{color:red}`,
        expected: ['.banner'],
    },
] as const;

export const SCOPE_ASSET_FILES = {
    'README.md': '![Logo](docs/assets/logo.svg#light)\n![Other logo](other/assets/unused.svg)\n',
    'docs/assets/logo.svg': '<svg/>',
    'docs/assets/unused.svg': '<svg/>',
    'other/assets/unused.svg': '<svg/>',
} as const;

export const ASSET_REFERENCE_CASES = [
    ['index.html', '<img src="assets/logo.svg">'],
    ['Logo.tsx', '<img src="assets/logo.svg" />'],
] as const;

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
