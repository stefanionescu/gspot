/** What kind of failure a GspotError reports; the command layer maps it to output and an exit code. */
export type ErrorCode =
    | 'filesystem'
    | 'settings'
    | 'configuration'
    | 'arguments'
    | 'git'
    | 'copy'
    | 'writing'
    | 'install'
    | 'check'
    | 'tool'
    | 'output'
    | 'skip'
    | 'pin'
    | 'prompt';
