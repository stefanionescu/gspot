export const BROAD_KILL_COMMANDS = new Map([
    ['pkill', '`pkill -f` stops every process whose command line matches. Stop the one process by its ID.'],
    ['killall', '`killall` stops every process with this name. Stop the one process by its ID.'],
]);
export const RECURSIVE_FLAG = /^(?:--recursive|-[^-Rr]*[Rr][^-]*)$/u;
export const RECURSIVE_REMOVE_MESSAGE =
    'This line deletes files recursively. Delete only a mktemp path in a trap, or ignore this rule with a reason.';
export const IGNORED_FAILURE_MESSAGE =
    '`|| true` hides the failure of this command. Handle the failure, or let it stop the script.';

export const RULES = {
    broadKill: 'broad-kill',
    recursiveRemove: 'recursive-remove',
    ignoredFailure: 'ignored-failure',
} as const;
