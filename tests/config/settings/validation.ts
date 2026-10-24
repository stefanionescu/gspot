export const INVALID_SETTING_MESSAGES = [
    {
        name: 'an unknown root key',
        text: '# The repository settings.\nnope = true\n',
        message:
            'gspot.toml:2: nope: `nope` is not a gspot.toml setting. Did you mean `scope`? See generativespotting.com/reference/gspot-toml/ for every key.',
    },
    {
        name: 'a wrong root enum type',
        text: '# The repository settings.\nlevel = 5\n',
        message: 'gspot.toml:2: level: The value 5 is not valid for level. Use recommended or all.',
    },
    {
        name: 'a wrong numeric setting',
        text: '# The repository settings.\n[format]\nindent_width = "wide"\n',
        message:
            'gspot.toml:3: format.indent_width: The value wide is not valid for format.indent_width. Use a whole number of 1 or more.',
    },
    {
        name: 'an unknown scope key',
        text: '# The repository settings.\n[[scope]]\npath = "api"\nkitz = []\n',
        message:
            'gspot.toml:4: scope.0.kitz: `kitz` is not a gspot.toml setting. Did you mean `site`? See generativespotting.com/reference/gspot-toml/ for every key.',
    },
    {
        name: 'a wrong scope value after another record',
        text: '[[scope]]\npath = "first"\n[[scope]]\npath = "second"\n[scope.format]\nindent_width = "wide"\n',
        message:
            'gspot.toml:6: scope.1.format.indent_width: The value wide is not valid for scope.1.format.indent_width. Use a whole number of 1 or more.',
    },
    {
        name: 'a wrong inline reasoned value',
        text: '[limits]\nfile_lines = { value = "large", reason = "The generated source has more lines." }\n',
        message:
            'gspot.toml:2: limits.file_lines.value: The value large is not valid for limits.file_lines.value. Use a whole number of 0 or more.',
    },
    {
        name: 'a multiline array item',
        text: 'configurations = [\n"bash",\n12\n]\n',
        message:
            'gspot.toml:3: configurations.1: The value 12 is not valid for configurations.1. Use a valid string value.',
    },
    {
        name: 'a missing record field',
        text: '[[ignore]]\ncheck = "bash/shellcheck"\n',
        message: 'gspot.toml:1: ignore.0.reason: needs a reason. Add `reason = "..."` to this record.',
    },
] as const;
