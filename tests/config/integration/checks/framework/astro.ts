export const ASTRO_PAGE = `---\nconst title: string = 'Home';\n---\n\n<h1>{title}</h1>\n<img src="logo.png" alt="The logo" />\n`;

/**
 * Astro types a template callback return as any and bundles a script that only imports a module. ESLint accepts both
 * forms and reports the set:html directive.
 */
export const BUNDLED_ASTRO_PAGE = `${ASTRO_PAGE}{[title].map((text) => <b>{text}</b>)}
<div set:html={title} />
<script>
    import '../answer.ts';
</script>
`;

export const ASTRO_PAGE_PATH = 'src/pages/index.astro';
