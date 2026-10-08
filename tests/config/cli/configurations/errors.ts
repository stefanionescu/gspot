export const WAITING_SETTING =
    '[[setting]]\nname = "tools.waiting.target"\ntype = "string"\ndirection = "neutral"\ndefault = ""\nsummary = "Where the tool looks."\n';

/** Two owners may vary this default while retaining the same public setting meaning. */
export const SHARED_SETTING = `[[setting]]
name = "example.target"
type = "string"
direction = "neutral"
default = "initial"
summary = "Where the example tool writes its output."
`;

/** A native floor must name a declared consumer with an inspectable version. */
export const MINIMUM_VERSION_CASES = [
    { target: 'other', versionCommand: 'version_command = ["--version"]\n', diagnostic: 'which it does not use' },
    { target: 'probe', versionCommand: '', diagnostic: 'requires a version command' },
    { target: 'probe', versionCommand: 'version_command = ["--version"]\n', diagnostic: undefined },
];

export const INVALID_VERSION_FLOORS = ['future', '4.4-beta', '4.4.0.1234'];

/** A generated file with a pointer and an executable supplied by another configuration. */
export const CONSUMER_DECLARATION = `[[config]]
target = ".gspot/config/example.toml"
tool = ["example"]
[config.stub_file]
path = "example.toml"
body = "config = {config}"
`;

/** A system executable has no downloaded package or version pin. */
export const SYSTEM_TOOL_DECLARATION = `[[tool]]
name = "example"
system = true
`;

export const SELECTOR_DECLARATION =
    '[[tool]]\nname = "example"\nversion = "1.0.0"\n[[tool.replace]]\nfile = "package.json"\n';
