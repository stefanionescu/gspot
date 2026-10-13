---
title: "Quickstart: Swift"
description: Set up a Swift project and fix a source finding.
---

Read [Install](/guides/install/) first. This example runs on macOS.

Replace `<version>` with the version you install, such as `0.1.2`.

## Create the project

```shell
mkdir orders-swift && cd orders-swift
git init
swift package init --type library
```

Replace the scaffold source and test with a small calculation and a test that uses it:

```swift title="Sources/orders-swift/orders_swift.swift"
public func total(_ values: [Int]) -> Int {
    values.reduce(0, +)
}
```

```swift title="Tests/orders-swiftTests/orders_swiftTests.swift"
import Testing
@testable import orders_swift

@Test func totalsValues() {
    #expect(total([1, 2, 3]) == 6)
}
```

## Install gspot

Pin gspot in the repository:

```shell
mise use node@24 --tool-option allow_low_downloads=true 'npm:@gspothq/cli@<version>'
```

## Set up the tools

```shell
mise exec -- gspot init --yes --configurations swift
```

`init` writes the files and installs nothing. Install the tools:

```shell
mise exec -- gspot install
```

## Check the project

Run checks when you want to inspect the project:

```shell
mise exec -- gspot check
```

Format the scaffold's package manifest and rerun the checks:

```shell
mise exec -- gspot check --fix
mise exec -- gspot check
```

## See a finding

Temporarily replace a source file with this forced cast:

```swift title="Sources/orders-swift/orders_swift.swift"
public func total(_ value: Any) -> Int {
    value as! Int
}
```

Run the source check:

```shell
mise exec -- gspot check --only swift/swiftlint
```

The check exits nonzero and reports:

```text
Sources/orders-swift/orders_swift.swift:2:11  force_cast  Force casts should be avoided
```

## Try the hook

Before fixing the source, you can stage the invalid file and try to commit it:

```shell
git add Sources/orders-swift/orders_swift.swift
git commit -m "feat: Add calculation"
```

The pre-commit hook refuses the commit and prints the same finding. After you fix the source, stage the valid file before you try the commit again.

## Fix the source

Restore the calculation that accepts integers:

```swift title="Sources/orders-swift/orders_swift.swift"
public func total(_ values: [Int]) -> Int {
    values.reduce(0, +)
}
```

```shell
mise exec -- gspot check --only swift/swiftlint
```

The same check now reports no forced-cast finding. To check additional conventions, select [level `all`](/guides/overview/#levels) with `mise exec -- gspot set level all`, run the checks, and resolve the findings.

## Continue

Read [Fix findings](/guides/findings/) for individual checks and [Reuse templates](/guides/templates/) to share settings with another repository.
