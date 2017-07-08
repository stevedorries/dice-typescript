import { NodeType } from "../../src/ast/node-type";
import { Token, TokenType } from "../../src/lexer";
import * as Parser from "../../src/parser";
import { MockLexer } from "../helpers/mock-lexer";

describe("DiceParser", () => {
    describe("parseDiceRoll", () => {
        it("can correctly parse a simple dice roll with pre-parsed number.", () => {
            const lexer = new MockLexer([
                new Token(TokenType.Integer, 0, "10"),
                new Token(TokenType.Identifier, 2, "d"),
                new Token(TokenType.Integer, 3, "6")
            ]);
            const parser = new Parser.DiceParser(lexer);
            const num = parser.parseInteger();
            const dice = parser.parseDiceRoll(num);
            expect(dice.type).toBe(NodeType.Dice);
            expect(dice.getChildCount()).toBe(2);
            expect(dice.getChild(0).type).toBe(NodeType.Integer);
            expect(dice.getChild(0).getAttribute("value")).toBe(10);
            expect(dice.getChild(1).type).toBe(NodeType.DiceSides);
            expect(dice.getChild(1).getAttribute("value")).toBe(6);
        });
        it("can correctly parse a simple dice roll.", () => {
            const lexer = new MockLexer([
                new Token(TokenType.Integer, 0, "10"),
                new Token(TokenType.Identifier, 2, "d"),
                new Token(TokenType.Integer, 3, "6")
            ]);
            const parser = new Parser.DiceParser(lexer);
            const dice = parser.parseDiceRoll();
            expect(dice.type).toBe(NodeType.Dice);
            expect(dice.getChildCount()).toBe(2);
            expect(dice.getChild(0).type).toBe(NodeType.Integer);
            expect(dice.getChild(0).getAttribute("value")).toBe(10);
            expect(dice.getChild(1).type).toBe(NodeType.DiceSides);
            expect(dice.getChild(1).getAttribute("value")).toBe(6);
        });
        // TODO: Check modifiers
    });
});
