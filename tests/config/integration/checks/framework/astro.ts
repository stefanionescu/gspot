import { ANSWER_MODULE } from '#tests/config/checks/component-samples.ts';

export const ASTRO_PAGE = `---\nconst title: string = 'Home';\n---\n\n<h1>{title}</h1>\n<img src="logo.png" alt="The logo" />\n`;

export const ASTRO_PAGE_PATH = 'src/pages/index.astro';

export const BUNDLED_ASTRO_FILES = {
    [ASTRO_PAGE_PATH]: `${ASTRO_PAGE}{[title].map((text) => <b>{text}</b>)}
<div set:html={title} />
<script>
    import './answer';
</script>
`,
    'src/pages/answer.ts': ANSWER_MODULE,
};
