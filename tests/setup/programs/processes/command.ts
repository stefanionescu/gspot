const [command = '', ...commandArguments] = process.argv.slice(2);
const result = Bun.spawnSync([command, ...commandArguments], { stdout: 'pipe', stderr: 'inherit' });
process.stdout.write(result.stdout);
process.exitCode = result.exitCode;
