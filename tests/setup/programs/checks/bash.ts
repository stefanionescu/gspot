for (const path of process.argv.slice(2)) {
    if (Bun.spawnSync(['bash', '-n', path]).exitCode === 0) continue;
    process.stdout.write(`${path}: syntax error\n`);
    process.exitCode = 1;
}
