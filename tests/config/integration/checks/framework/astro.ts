import { ANSWER_MODULE } from '#tests/config/checks/component-samples.ts';

/** An Astro page that passes ESLint, astro check, and Prettier. */
export const ASTRO_PAGE = `---\nconst title: string = 'Home';\n---\n\n<h1>{title}</h1>\n<img src="logo.png" alt="The logo" />\n`;

/** Where the sandbox keeps the page. */
export const ASTRO_PAGE_PATH = 'src/pages/index.astro';

/**
 * Astro types a template callback return as any and bundles a script that only imports a module. ESLint accepts both
 * forms and reports the set:html directive.
 */
export const BUNDLED_ASTRO_FILES = {
    [ASTRO_PAGE_PATH]: `${ASTRO_PAGE}{[title].map((text) => <b>{text}</b>)}
<div set:html={title} />
<script>
    import './answer';
</script>
`,
    'src/pages/answer.ts': ANSWER_MODULE,
};
