import { identifiersOf } from '#cli/checks/naming/extract.ts';
import { describe, expect, test } from 'bun:test';

const SOURCE = String.raw`import Foundation

protocol Greeter { func greet(name: String) -> String }
enum Mood { case happy, sad; case veryAngry(level: Int) }
struct UserProfile: Greeter {
    static let maxCount = 3
    var display_name: String
    func greet(name userName: String) -> String { let local_value = 1; return "\(local_value)" }
    init(id: Int) { self.display_name = "" }
}
typealias Handler = () -> Void
extension UserProfile { var short: String { "" } }
func top_level(_ value: Int, with label: String) {}
let globalConstant = 1
`;

describe('swiftIdentifiers', () => {
    test('every declared name arrives with its category', async () => {
        const found = await identifiersOf('Sources/User.swift', SOURCE, 'swift');
        const names = (category: string): string[] =>
            found.filter((entry) => entry.category === category).map((entry) => entry.name);
        expect(names('types')).toStrictEqual(['Greeter', 'Mood', 'UserProfile', 'Handler']);
        expect(names('methods')).toStrictEqual(['greet', 'greet']);
        expect(names('functions')).toStrictEqual(['top_level']);
        expect(names('parameters')).toStrictEqual(['name', 'userName', 'id', 'value', 'label']);
        expect(names('properties')).toStrictEqual(['maxCount', 'display_name', 'short']);
        expect(names('variables')).toStrictEqual(['local_value']);
        expect(names('constants')).toStrictEqual(['globalConstant']);
        expect(names('enum_cases')).toStrictEqual(['happy', 'sad', 'veryAngry']);
    });
});
