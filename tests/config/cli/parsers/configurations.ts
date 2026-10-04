export const SELECTOR_DECLARATION =
    '[[tool]]\nname = "example"\nversion = "1.0.0"\n[[tool.replace]]\nfile = "package.json"\n';

export const SECURITY_DECLARATION = '[[tool]]\nname = "codeql"\nversion = "2.24.3"\n';

export const TOOL_DECLARATION = '[[tool]]\nname = "example"\nversion = "1.0.0"\n';

export const SUPPRESSION_DECLARATION =
    '[[tool]]\nname = "example"\n[tool.suppression]\nmarker = "# file-disable"\nreason = "reason: (?<reason>.+)"\n';

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
