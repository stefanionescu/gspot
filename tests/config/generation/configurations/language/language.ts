export const SWIFT_PROJECT_SETTINGS = `configurations = ["swift", "xcode"]
[[scope]]
path = "nested"
swift = {xcode_project = "nested/Chosen.xcodeproj"}
[[scope]]
path = "disabled"
removed_configurations = { swift = "This scope does not build Swift projects." }

[swift]
xcode_project = "Chosen.xcodeproj"
xcode_destination = "custom root destination"
`;
