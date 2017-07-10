import * as Ast from "../ast";
import { Lexer, TokenType } from "../lexer";
import { BasicParser } from "./basic-parser";

const BooleanOperatorMap: { [token: string]: Ast.NodeType } = {};
BooleanOperatorMap[TokenType.Equals] = Ast.NodeType.Equal;
BooleanOperatorMap[TokenType.Greater] = Ast.NodeType.Greater;
BooleanOperatorMap[TokenType.Less] = Ast.NodeType.Less;
BooleanOperatorMap[TokenType.GreaterOrEqual] = Ast.NodeType.GreaterOrEqual;
BooleanOperatorMap[TokenType.LessOrEqual] = Ast.NodeType.LessOrEqual;

const AddOperatorMap: { [token: string]: Ast.NodeType } = {};
AddOperatorMap[TokenType.Plus] = Ast.NodeType.Add;
AddOperatorMap[TokenType.Minus] = Ast.NodeType.Subtract;

const MultiOperatorMap: { [token: string]: Ast.NodeType } = {};
MultiOperatorMap[TokenType.DoubleAsterisk] = Ast.NodeType.Exponent;
MultiOperatorMap[TokenType.Asterisk] = Ast.NodeType.Multiply;
MultiOperatorMap[TokenType.Slash] = Ast.NodeType.Divide;
MultiOperatorMap[TokenType.Percent] = Ast.NodeType.Modulo;

export class DiceParser extends BasicParser {
    constructor(input: Lexer | string) { super(input); }

    parse(): Ast.ExpressionNode {
        return this.parseExpression();
    }

    parseExpression(): Ast.ExpressionNode {
        let root = this.parseSimpleExpression();
        const tokenType = this.lexer.peekNextToken().type;
        if (Object.keys(BooleanOperatorMap).indexOf(tokenType.toString()) > -1) {
            const newRoot = Ast.Factory.create(BooleanOperatorMap[tokenType]);
            this.lexer.getNextToken();
            newRoot.addChild(root);
            newRoot.addChild(this.parseSimpleExpression());
            root = newRoot;
        }
        return root;
    }

    parseSimpleExpression(): Ast.ExpressionNode {
        let tokenType = this.lexer.peekNextToken().type;
        if (Object.keys(AddOperatorMap).indexOf(tokenType.toString()) > -1) {
            this.lexer.getNextToken();
        }

        let root = this.parseTerm();

        if (tokenType === TokenType.Minus) {
            const negateNode = Ast.Factory.create(Ast.NodeType.Negate);
            negateNode.addChild(root);
            root = negateNode;
        }

        tokenType = this.lexer.peekNextToken().type;
        while (Object.keys(AddOperatorMap).indexOf(tokenType.toString()) > -1) {
            const newRoot = Ast.Factory.create(AddOperatorMap[tokenType]);
            newRoot.addChild(root);

            // Consume the operator.
            this.lexer.getNextToken();

            newRoot.addChild(this.parseTerm());

            root = newRoot;
            tokenType = this.lexer.peekNextToken().type;
        }
        return root;
    }

    parseTerm(): Ast.ExpressionNode {
        let root: Ast.ExpressionNode = this.parseFactor();

        let tokenType = this.lexer.peekNextToken().type;
        while (Object.keys(MultiOperatorMap).indexOf(tokenType.toString()) > -1) {
            const newRoot = Ast.Factory.create(MultiOperatorMap[tokenType]);
            newRoot.addChild(root);

            // Consume the operator.
            this.lexer.getNextToken();
            newRoot.addChild(this.parseFactor());

            root = newRoot;
            tokenType = this.lexer.peekNextToken().type;
        }

        return root;
    }

    parseFactor(): Ast.ExpressionNode {
        let root: Ast.ExpressionNode;
        const token = this.lexer.peekNextToken();
        switch (token.type) {
            case TokenType.Identifier:
                root = this.parseFunctionCall();
                break;
            case TokenType.ParenthesisOpen:
                root = this.parseBracketedExpression();
                if (this.lexer.peekNextToken().type === TokenType.Identifier) {
                    root = this.parseDiceRoll(root);
                }
                break;
            case TokenType.BraceOpen:
                root = this.parseExpressionGroup();
                break;
            case TokenType.Integer:
                const number = this.parseInteger();
                if (this.lexer.peekNextToken().type !== TokenType.Identifier) {
                    root = number;
                } else {
                    root = this.parseDiceRoll(number);
                }
                break;
            default: this.error(TokenType.Integer, token);
        }
        return root;
    }

    parseFunctionCall(): Ast.ExpressionNode {
        const functionName = this.expectAndConsume(TokenType.Identifier);
        const root = Ast.Factory.create(Ast.NodeType.Function)
            .setAttribute("name", functionName.value);

        this.expectAndConsume(TokenType.ParenthesisOpen)

        // Parse function arguments.
        const token = this.lexer.peekNextToken();
        if (token.type !== TokenType.ParenthesisClose) {
            root.addChild(this.parseExpression());
            while (this.lexer.peekNextToken().type === TokenType.Comma) {
                this.lexer.getNextToken(); // Consume the comma.
                root.addChild(this.parseExpression());
            }
        }

        this.expectAndConsume(TokenType.ParenthesisClose);

        return root;
    }

    parseInteger(): Ast.ExpressionNode {
        const numberToken = this.lexer.getNextToken();
        return Ast.Factory.create(Ast.NodeType.Integer)
            .setAttribute("value", Number(numberToken.value));
    }

    parseBracketedExpression(): Ast.ExpressionNode {
        this.lexer.getNextToken(); // Consume the opening bracket.
        const root = this.parseExpression();
        this.expectAndConsume(TokenType.ParenthesisClose);
        return root;
    }

    parseExpressionGroup(): Ast.ExpressionNode {
        this.lexer.getNextToken(); // Consume the opening brace.

        const root = Ast.Factory.create(Ast.NodeType.Group);

        // Parse group elements.
        const token = this.lexer.peekNextToken();
        if (token.type !== TokenType.BraceClose) {
            root.addChild(this.parseExpression());
            while (this.lexer.peekNextToken().type === TokenType.Comma) {
                this.lexer.getNextToken(); // Consume the comma.
                root.addChild(this.parseExpression());
            }
        }

        this.expectAndConsume(TokenType.BraceClose);

        return root;
    }

    parseDiceRoll(rollTimes?: Ast.ExpressionNode): Ast.ExpressionNode {
        const root = this.parseSimpleDiceRoll(rollTimes);
        // TODO: Parse modifiers.
        return root;
    }

    parseSimpleDiceRoll(rollTimes?: Ast.ExpressionNode): Ast.ExpressionNode {
        if (!rollTimes) {
            const rollToken = this.lexer.peekNextToken();
            switch (rollToken.type) {
                case TokenType.Integer: rollTimes = this.parseInteger(); break;
                case TokenType.ParenthesisOpen: rollTimes = this.parseBracketedExpression(); break;
                default: this.error(TokenType.Integer, rollToken);
            }
        }

        const token = this.expectAndConsume(TokenType.Identifier);

        const root = Ast.Factory.create(Ast.NodeType.Dice);
        root.addChild(rollTimes);

        switch (token.value) {
            case "d":
                const sidesToken = this.expectAndConsume(TokenType.Integer);
                root.addChild(Ast.Factory.create(Ast.NodeType.DiceSides))
                    .setAttribute("value", Number(sidesToken.value));
                break;
            case "dF":
                root.addChild(Ast.Factory.create(Ast.NodeType.DiceSides))
                    .setAttribute("value", "fate");
                break;
        }

        return root;
    }
}