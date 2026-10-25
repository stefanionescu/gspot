// eslint-disable-next-line n/no-process-env -- reason: Node runs this program to read the variable names the way Node does.
for (const name of process.argv.slice(2)) process.stdout.write(process.env[name] ?? '');
