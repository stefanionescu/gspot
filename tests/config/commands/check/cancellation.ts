const SLOW_TOOL_SCRIPT =
    'require("node:fs").writeFileSync("started.tmp", String(process.pid)); require("node:fs").renameSync("started.tmp", "started.pid"); await Bun.sleep(60_000);';

export const SLOW_COMMAND_CHECK = {
    id: 'project/slow',
    stage: 'commit',
    paths: ['source.txt'],
    command: [process.execPath, '-e', SLOW_TOOL_SCRIPT],
};
