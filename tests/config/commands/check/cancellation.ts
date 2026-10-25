export const SLOW_COMMAND_CHECK = {
    id: 'project/slow',
    stage: 'commit',
    paths: ['source.txt'],
};

export const SLOW_TOOL_ARGUMENTS = ['--mark', 'started.pid', '--wait'];
