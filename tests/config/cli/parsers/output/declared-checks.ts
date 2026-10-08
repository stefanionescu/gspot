// Prints each line of the listed files that holds PENDING as file:line:text, the way grep -n -H does.
export const PENDING = String.raw`let found = false;
for (const file of process.argv.slice(1))
    for (const [index, line] of (await Bun.file(file).text()).split('\n').entries())
        if (line.includes('PENDING')) { console.log(file + ':' + String(index + 1) + ':' + line); found = true; }
process.exit(found ? 1 : 0);`;
