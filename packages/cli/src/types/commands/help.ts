/** Content shared by native command help and the command reference. */
export type CommandHelp = {
    /** Exit statuses and their meanings. */
    exitCodes: string;
    /** Complete command lines. */
    examples: string;
    /** Coverage descriptions when the command explains levels. */
    levels?: string;
};
