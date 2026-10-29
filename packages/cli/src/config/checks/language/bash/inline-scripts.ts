export const RUNTIME_EMBEDS = [
    [/\$(?:\w+|\{\w+(?::-[^}\n]*)?\})"?\s+-[ce]\b/u, 'an inline command in an interpreter variable'],
    [/\bpython[0-9.]*\s+-c\b/u, 'an inline Python command'],
    [/\bpython[0-9.]*\s+<</u, 'an inline Python heredoc'],
    [/\bpython[0-9.]*\s+-\s*<</u, 'an inline Python heredoc'],
    [/\$\w+"?\s+-\s*<</u, 'a heredoc piped into an interpreter variable'],
    [/\$\{\w+\}"?\s+-\s*<</u, 'a heredoc piped into an interpreter variable'],
    [/\bnode\s+(?:-[ep]|--eval|--print)\b/u, 'an inline Node command'],
    [/\bnode\s+<</u, 'an inline Node heredoc'],
    [/\bbun\s+(?:-[ep]|--eval|--print)\b/u, 'an inline Bun command'],
    [/\bdeno\s+eval\b/u, 'an inline Deno command'],
    [/\bperl(?:\s+-[a-zA-Z]+)*?\s+-[a-zA-Z]*e(?=\s|$)/u, 'an inline Perl command'],
    [/\bruby(?:\s+-[a-zA-Z]+)*?\s+-[a-zA-Z]*e(?=\s|$)/u, 'an inline Ruby command'],
] as const;

export const RUNTIME_EMBED_RULE = 'runtime-embed';
