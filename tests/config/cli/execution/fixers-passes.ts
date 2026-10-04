// A check that fails while a file holds its first argument, and a correction that replaces that text with its second.
export const TEXT_CHECK =
    'const [, text, ...paths] = process.argv; const bodies = await Promise.all(paths.map((path) => Bun.file(path).text())); process.exitCode = bodies.some((body) => body.includes(text)) ? 1 : 0;';

export const TEXT_FIX =
    'const [, text, replacement, ...paths] = process.argv; for (const path of paths) await Bun.write(path, (await Bun.file(path).text()).replaceAll(text, replacement));';
