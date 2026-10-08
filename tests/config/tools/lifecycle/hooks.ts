export const SAMPLE_COMMAND =
    'const found = process.argv.slice(1).filter((path) => require("node:fs").readFileSync(path, "utf8").includes("DEFECT")); found.forEach((path) => console.log(path)); process.exitCode = found.length > 0 ? 1 : 0;';

export const INDEX_COMMAND =
    'if ((await Bun.file("source.txt").text()).trim() === "invalid") { console.log("Indexed defect"); process.exitCode = 1; }';
