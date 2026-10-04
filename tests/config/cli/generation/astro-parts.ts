/** An Astro component containing frontmatter, markup, and a script. */
export const COMPONENT =
    '---\nconst html: string = "<b>bold</b>";\nconst flag = true as const;\nif (flag) console.info(html);\n---\n<img src="a.png">\n<div set:html={html} />\n<script>\n  const left = 2;\n</script>\n';
