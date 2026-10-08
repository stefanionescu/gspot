export const SWITCHED =
    'import Foundation\n\nprivate func label(_ count: Int) -> String {\n    switch count {\n    case 0:\n        "none"\n    case 1:\n        "one"\n    default:\n        "many"\n    }\n}\n\n/// The label of a pair.\nfunc pairLabel() -> String {\n    let text = label(2)\n    return text + "!"\n}\n';

export const NEGATED =
    'import Foundation\n\n/// Whether a name is new.\nfunc isNew(_ name: String) -> Bool {\n    !["a", "b"].contains(name)\n}\n';

export const TRIVIAL_FUNCTION_CASES = [
    { name: 'switch expression', source: SWITCHED, line: 15 },
    { name: 'negated call', source: NEGATED, line: 4 },
] as const;

/** Implicit and explicit property readers with separate observer and subscript locations. */
export const PROPERTY_READERS = `struct A {
    var x: Int { 1 }
    var y = 0 {
        willSet { save(newValue) }
        didSet { save(oldValue) }
    }
    subscript(i: Int) -> Int {
        get { 1 }
        set { save(newValue) }
    }
}`;
