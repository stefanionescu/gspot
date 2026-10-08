/** A list whose item fields are authored metadata, including nested scope paths. */
export const RECORD_SETTING_DECLARATION = `[[setting]]
name = "example.targets"
type = "list"
direction = "neutral"
summary = "Typed target records retain their limits and optional explanation."
[setting.items]
name = "string"
paths = { type = "list", items = "path" }
percent = { type = "number", validation = { minimum = 0, maximum = 100 } }
reason = { type = "string", optional = true }
`;

/** A scalar's constraints belong to its owning declaration. */
export const NUMBER_SETTING_DECLARATION = `[[setting]]
name = "example.floor"
type = "number"
direction = "floor"
summary = "An integer floor constrained by the owning configuration."
[setting.validation]
integer = true
minimum = 1
maximum = 4
`;
