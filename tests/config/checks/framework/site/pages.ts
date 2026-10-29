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
