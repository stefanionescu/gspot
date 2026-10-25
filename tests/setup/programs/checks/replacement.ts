const [text = '', replacement = '', ...paths] = process.argv.slice(2);
for (const path of paths) {
    const content = await Bun.file(path).text();
    await Bun.write(path, content.replaceAll(text, replacement));
}
