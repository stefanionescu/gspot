process.stdout.write(await Bun.file(Bun.resolveSync('tool/lib/value.txt', import.meta.dir)).text());
