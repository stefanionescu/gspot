export const CLEAN = `---\nconst title: string = 'Home';\n---\n\n<h1>{title}</h1>\n<img src="logo.png" alt="The logo" />\n`;

export const PAGE = 'src/pages/index.astro';

// Astro types the markup a template callback returns as any. A script that only imports a module is how Astro bundles
// client code. ESLint reports neither, and it does report the set:html directive.
export const BUNDLED = `${CLEAN}{[title].map((text) => <b>{text}</b>)}\n<div set:html={title} />\n<script>\n    import '../answer.ts';\n</script>\n`;
