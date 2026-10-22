/**
 * A program that writes its process ID to started.tmp, renames the file to started.pid, and waits, so started.pid never
 * holds part of an ID.
 */
export const SLOW_TOOL_SCRIPT =
    'require("node:fs").writeFileSync("started.tmp", String(process.pid)); require("node:fs").renameSync("started.tmp", "started.pid"); await Bun.sleep(60_000);';
