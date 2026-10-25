const paths = process.argv.slice(2);
const reports = await Promise.all(paths.map(async (file) => ({ file, message: await Bun.file(file).text() })));
process.stdout.write(`${JSON.stringify(reports)}\n`);
process.exitCode = 1;
