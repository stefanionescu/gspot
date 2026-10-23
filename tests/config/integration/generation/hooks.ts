export const SAMPLE_COMMAND =
    'const found = process.argv.slice(1).filter((path) => require("node:fs").readFileSync(path, "utf8").includes("DEFECT")); found.forEach((path) => console.log(path)); process.exitCode = found.length > 0 ? 1 : 0;';

export const INDEX_COMMAND =
    'if ((await Bun.file("source.txt").text()).trim() === "invalid") { console.log("source.txt:1: Indexed defect"); process.exitCode = 1; }';

/** The report line of the ShellCheck finding for `echo $1` on line 2 of scripts/b.sh. */
export const UNQUOTED_FINDING_LINE = '  scripts/b.sh:2:6  SC2086  Double quote to prevent globbing and word splitting.';
