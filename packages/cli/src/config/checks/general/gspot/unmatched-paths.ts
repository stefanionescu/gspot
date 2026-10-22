export const NEGATED_PATTERN = /^!/u;

export const UNESCAPED_GROUP = /(?<!\\)[()[\]]/u;

export const GROUP_HELP = String.raw` If a folder name holds ( ) [ ], escape each with a backslash in a TOML literal string, such as 'app/\(legal\)/**'.`;
