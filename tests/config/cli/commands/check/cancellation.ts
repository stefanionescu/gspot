/** The cancellation probe runs one subprocess whose lifetime it observes. */
export const SLOW_CHECK = ['check', '--only', 'project/slow', '--json'];

/** Publish readiness only after the child's PID is complete. */
export const SLOW_TOOL_PROGRAM =
    'require("node:fs").writeFileSync("started.tmp", String(process.pid)); require("node:fs").renameSync("started.tmp", "started.pid"); await Bun.sleep(60_000);';
