/** A list whose item fields are authored metadata, including nested scope paths. */
export const RECORD_SETTING_DECLARATION = `[[setting]]
name = "example.targets"
type = "list"
summary = "Typed target records retain their limits and optional explanation."
items = { name = "string", paths = { type = "list", items = "path" }, percent = { type = "number", validation = { minimum = 0, maximum = 100 } }, reason = { type = "string", optional = true } }
`;

/** A scalar's constraints belong to its owning declaration. */
export const NUMBER_SETTING_DECLARATION = `[[setting]]
name = "example.floor"
type = "number"
direction = "floor"
summary = "An integer floor constrained by the owning configuration."
validation = { integer = true, minimum = 1, maximum = 4 }
`;

export const NATIVE_ITEM_DECLARATIONS = [
    {
        name: 'format.overrides',
        value: '[{ paths = ["src/**"], indent_style = "tab" }]',
        invalid: '[{ paths = ["src/**"] }]',
        diagnostic: 'format.overrides.default.0: A format override needs at least one formatting option.',
    },
    {
        name: 'tools.eslint.overrides',
        value: '[{ paths = ["src/**"], rules = { "no-alert" = [] } }]',
        invalid: '[{ paths = [], rules = { "no-alert" = [] } }]',
        diagnostic: 'tools.eslint.overrides.default.0.paths: Too small: expected array to have >=1 items',
    },
];

export const NATIVE_ITEM_DECLARATION = `[[setting]]
name = "format.overrides"
type = "list"
items = "native"
summary = "The item contract belongs to this setting's native schema."
`;

export const INVALID_NATIVE_ITEM_OWNERS = ['example.targets', 'format.print_width'];
