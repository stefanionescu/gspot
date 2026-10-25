const modules = await Promise.all(
    process.argv.slice(2).map(async (path) => ((await import(path)) as { default: unknown }).default),
);
process.stdout.write(JSON.stringify(modules));
