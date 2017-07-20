import { ErrorMessage } from "./error-message";
import * as Ast from "../ast";
import { DefaultRandomProvider } from "../default-random-provider";
import { RandomProvider } from "../random-provider";
import { DefaultFunctionDefinitions } from "./default-function-definitions";
import { DiceResult } from "./dice-result";
import { FunctionDefinitionList } from "./function-definition-list";
import { Interpreter } from "./interpreter";

export class DiceInterpreter implements Interpreter<DiceResult> {
    protected functions: FunctionDefinitionList;
    protected random: RandomProvider;

    constructor(functions?: FunctionDefinitionList, random?: RandomProvider) {
        this.functions = DefaultFunctionDefinitions;
        (<any>Object).assign(this.functions, functions);
        this.random = random || new DefaultRandomProvider()
    }

    interpret(expression: Ast.ExpressionNode): DiceResult {
        const exp = expression.copy();
        const errors: ErrorMessage[] = []
        const total = this.evaluate(exp, errors);
        const successes = this.countSuccesses(exp, errors);
        const fails = this.countFailures(exp, errors);
        return new DiceResult(exp, total, successes, fails, errors);
    }

    evaluate(expression: Ast.ExpressionNode, errors: ErrorMessage[]): any {
        if (!expression) { throw new Error("Null node reference found."); }
        if (expression.type === Ast.NodeType.DiceRoll) {
            return this.evaluateDiceRoll(expression, errors);
        } else if (!expression.getAttribute("value")) {
            let value: any = 0;
            switch (expression.type) {
                case Ast.NodeType.Add:
                    this.expectChildCount(expression, 2, errors);
                    value = this.evaluate(expression.getChild(0), errors) + this.evaluate(expression.getChild(1), errors);
                    break;
                case Ast.NodeType.Subtract:
                    this.expectChildCount(expression, 2, errors);
                    value = this.evaluate(expression.getChild(0), errors) - this.evaluate(expression.getChild(1), errors);
                    break;
                case Ast.NodeType.Multiply:
                    this.expectChildCount(expression, 2, errors);
                    value = this.evaluate(expression.getChild(0), errors) * this.evaluate(expression.getChild(1), errors);
                    break;
                case Ast.NodeType.Divide:
                    this.expectChildCount(expression, 2, errors);
                    value = this.evaluate(expression.getChild(0), errors) / this.evaluate(expression.getChild(1), errors);
                    break;
                case Ast.NodeType.Modulo:
                    this.expectChildCount(expression, 2, errors);
                    value = this.evaluate(expression.getChild(0), errors) % this.evaluate(expression.getChild(1), errors);
                    break;
                case Ast.NodeType.Negate:
                    this.expectChildCount(expression, 1, errors);
                    value = -this.evaluate(expression.getChild(0), errors);
                    break;
                case Ast.NodeType.DiceSides: value = expression.getAttribute("value"); break;
                case Ast.NodeType.Dice: value = this.evaluateDice(expression, errors); break;
                case Ast.NodeType.Integer: value = expression.getAttribute("value"); break;
                case Ast.NodeType.Function: value = this.evaluateFunction(expression, errors); break;
                case Ast.NodeType.Group: value = this.evaluateGroup(expression, errors); break;
                case Ast.NodeType.Explode: value = this.evaluateExplode(expression, errors); break;
                case Ast.NodeType.Keep: value = this.evaluateKeep(expression, errors); break;
                case Ast.NodeType.Drop: value = this.evaluateDrop(expression, errors); break;
                case Ast.NodeType.Critical: value = this.evaluateCritical(expression, errors); break;
                case Ast.NodeType.Reroll: value = this.evaluateReroll(expression, errors); break;
                case Ast.NodeType.Sort: value = this.evaluateSort(expression, errors); break;
                case Ast.NodeType.Exponent:
                    this.expectChildCount(expression, 2, errors);
                    value = Math.pow(this.evaluate(expression.getChild(0), errors), this.evaluate(expression.getChild(1), errors));
                    break;
                case Ast.NodeType.Equal:
                case Ast.NodeType.Greater:
                case Ast.NodeType.GreaterOrEqual:
                case Ast.NodeType.Less:
                case Ast.NodeType.LessOrEqual:
                    for (let x = 0; x < expression.getChildCount(); x++) {
                        this.evaluate(expression.getChild(x), errors);
                    }
                    break;
                default: throw new Error("Unrecognized node.");
            }
            expression.setAttribute("value", value);
        }
        return expression.getAttribute("value");
    }

    evaluateComparison(lhs: number, expression: Ast.ExpressionNode, errors: ErrorMessage[]): boolean {
        this.expectChildCount(expression, 1, errors);
        switch (expression.type) {
            case Ast.NodeType.Equal: return lhs === this.evaluate(expression.getChild(0), errors);
            case Ast.NodeType.Greater: return lhs > this.evaluate(expression.getChild(0), errors);
            case Ast.NodeType.GreaterOrEqual: return lhs >= this.evaluate(expression.getChild(0), errors);
            case Ast.NodeType.Less: return lhs < this.evaluate(expression.getChild(0), errors);
            case Ast.NodeType.LessOrEqual: return lhs <= this.evaluate(expression.getChild(0), errors);
            default: throw new Error("Unrecognized comparison operator.");
        }
    }

    private evaluateDiceRoll(expression: Ast.ExpressionNode, errors: ErrorMessage[]): number {
        if (expression.getAttribute("drop") !== "yes") {
            return expression.getAttribute("value");
        }
        return 0;
    }

    private evaluateDice(expression: Ast.ExpressionNode, errors: ErrorMessage[]): number {
        this.expectChildCount(expression, 2, errors);
        const num = Math.round(this.evaluate(expression.getChild(0), errors));
        const sides = expression.getChild(1);
        expression.setAttribute("sides", this.evaluate(sides, errors));

        expression.clearChildren();

        let total = 0;
        for (let x = 0; x < num; x++) {
            const diceRoll = this.createDiceRoll(sides, errors);
            expression.addChild(diceRoll);
            total += this.evaluate(diceRoll, errors);
        }
        return total;
    }

    private evaluateFunction(expression: Ast.ExpressionNode, errors: ErrorMessage[]): number {
        const fName = expression.getAttribute("name");
        if (Object.keys(this.functions).indexOf(fName) === -1) {
            throw new Error(`Unknown function: ${fName}`);
        }
        const result = this.functions[fName](this, expression, errors);
        return result;
    }

    private evaluateGroup(expression: Ast.ExpressionNode, errors: ErrorMessage[]): number {
        let total = 0;
        for (let x = 0; x < expression.getChildCount(); x++) {
            total += this.evaluate(expression.getChild(x), errors);
        }
        return total;
    }

    private evaluateExplode(expression: Ast.ExpressionNode, errors: ErrorMessage[]): number {
        this.expectChildCount(expression, 1, errors);
        const dice = this.findLeftmostDiceNode(expression, errors);
        let condition: Ast.ExpressionNode;
        const penetrate = expression.getAttribute("penetrate") === "yes";
        if (expression.getChildCount() > 1) {
            condition = expression.getChild(1);
            this.evaluate(condition, errors);
        }

        this.evaluate(dice, errors);

        const newRolls: Ast.ExpressionNode[] = [];

        let total = 0;
        const sides = dice.getAttribute("sides");
        for (let rollIndex = 0; rollIndex < dice.getChildCount(); rollIndex++) {
            let die = dice.getChild(rollIndex);
            if (die.getAttribute("drop") === "yes") { continue; }
            let dieValue = this.evaluate(die, errors);
            total += dieValue;
            while (condition && this.evaluateComparison(dieValue, condition, errors) || dieValue === sides) {
                die = this.createDiceRoll(sides, errors);
                dieValue = this.evaluate(die, errors);
                if (penetrate) { dieValue -= 1; }
                total += dieValue;
                newRolls.push(die);
            }
        }

        newRolls.forEach(newRoll => dice.addChild(newRoll));
        return total;
    }

    private evaluateKeep(expression: Ast.ExpressionNode, errors: ErrorMessage[]): number {
        this.expectChildCount(expression, 1, errors);
        const dice = this.findLeftmostDiceNode(expression, errors);
        const countTotal = (expression.getChildCount() > 1) ? this.evaluate(expression.getChild(1), errors) : 1;
        const type = expression.getAttribute("type");
        this.evaluate(dice, errors);

        const rolls = this.getSortedDiceRolls(dice, (type === "lowest") ? "ascending" : "descending", errors).rolls;

        let count = 0;
        let total = 0;
        rolls.forEach(roll => {
            if (count < countTotal) {
                roll.setAttribute("drop", "no");
                total += roll.getAttribute("value");
            } else {
                roll.setAttribute("drop", "yes");
            }
            count++;
        });
        return total;
    }

    private evaluateDrop(expression: Ast.ExpressionNode, errors: ErrorMessage[]): number {
        this.expectChildCount(expression, 1, errors);
        const dice = this.findLeftmostDiceNode(expression, errors);
        const countTotal = (expression.getChildCount() > 1) ? this.evaluate(expression.getChild(1), errors) : 1;
        const type = expression.getAttribute("type");
        this.evaluate(dice, errors);

        const rolls = this.getSortedDiceRolls(dice, (type === "lowest") ? "ascending" : "descending", errors).rolls;
        let count = 0;
        let total = 0;
        rolls.forEach(roll => {
            if (count < countTotal) {
                roll.setAttribute("drop", "yes");
            } else {
                roll.setAttribute("drop", "no");
                total += roll.getAttribute("value");
            }
            count++;
        });
        return total;
    }

    private evaluateCritical(expression: Ast.ExpressionNode, errors: ErrorMessage[]): number {
        this.expectChildCount(expression, 1, errors);
        const dice = this.findLeftmostDiceNode(expression, errors);
        const type = expression.getAttribute("type");

        let condition: Ast.ExpressionNode;
        if (expression.getChildCount() > 1) {
            condition = expression.getChild(1);
            this.evaluate(condition, errors);
        } else {
            condition = Ast.Factory.create(Ast.NodeType.Equal);
            if (type === "success") {
                this.expectChildCount(dice, 2, errors);
                condition.addChild(Ast.Factory.create(Ast.NodeType.Integer).setAttribute("value", dice.getAttribute("sides")));
            } else {
                condition.addChild(Ast.Factory.create(Ast.NodeType.Integer).setAttribute("value", 1));
            }
        }

        this.evaluate(dice, errors);

        let total = 0;
        for (let rollIndex = 0; rollIndex < dice.getChildCount(); rollIndex++) {
            const die = dice.getChild(rollIndex);
            const dieValue = this.evaluate(die, errors);
            if (this.evaluateComparison(dieValue, condition, errors)) {
                die.setAttribute("critical", type);
            }
            total += dieValue;
        }

        return total;
    }

    private evaluateReroll(expression: Ast.ExpressionNode, errors: ErrorMessage[]): number {
        this.expectChildCount(expression, 1, errors);
        const dice = this.findLeftmostDiceNode(expression, errors);
        let condition: Ast.ExpressionNode;
        const once = expression.getAttribute("once") === "yes";
        if (expression.getChildCount() > 1) {
            condition = expression.getChild(1);
            this.evaluate(condition, errors);
        }

        this.evaluate(dice, errors);

        let total = 0;
        const sides = dice.getAttribute("sides");
        for (let rollIndex = 0; rollIndex < dice.getChildCount(); rollIndex++) {
            const die = dice.getChild(rollIndex);
            if (die.getAttribute("drop") === "yes") { continue; }
            let dieValue = this.evaluate(die, errors);
            while (condition && this.evaluateComparison(dieValue, condition, errors) || dieValue === 1) {
                dieValue = this.createDiceRollValue(sides, errors);
                if (once) { break; }
            }
            die.setAttribute("value", dieValue);
            total += dieValue;
        }

        return total;
    }

    private evaluateSort(expression: Ast.ExpressionNode, errors: ErrorMessage[]): number {
        this.expectChildCount(expression, 1, errors);
        const dice = this.findLeftmostDiceNode(expression, errors);
        const rolls = this.getSortedDiceRolls(dice, expression.getAttribute("direction"), errors);
        dice.clearChildren();
        rolls.rolls.forEach(roll => dice.addChild(roll));
        return rolls.total;
    }

    private findLeftmostDiceNode(expression: Ast.ExpressionNode, errors: ErrorMessage[]): Ast.ExpressionNode {
        if (expression.type === Ast.NodeType.Dice) {
            return expression;
        }
        if (expression.getChildCount() < 1) {
            throw new Error("Missing dice node.");
        }
        const child = expression.getChild(0);
        this.evaluate(child, errors);
        return this.findLeftmostDiceNode(child, errors);
    }

    private getSortedDiceRolls(dice: Ast.ExpressionNode, direction: string, errors: ErrorMessage[]):
        { rolls: Ast.ExpressionNode[], total: number } {
        const output = { rolls: [], total: 0 };

        for (let rollIndex = 0; rollIndex < dice.getChildCount(); rollIndex++) {
            const die = dice.getChild(rollIndex);
            output.rolls.push(die);
            output.total += this.evaluate(die, errors);
        }

        let sortOrder;
        if (direction === "descending") {
            sortOrder = (a, b) => b.getAttribute("value") - a.getAttribute("value");
        } else if (direction === "ascending") {
            sortOrder = (a, b) => a.getAttribute("value") - b.getAttribute("value");
        } else {
            // TODO: Add error.
        }

        output.rolls = output.rolls.sort(sortOrder);
        return output;
    }

    private createDiceRoll(sides: Ast.ExpressionNode | number, errors: ErrorMessage[]): Ast.ExpressionNode {
        const sidesValue = sides instanceof Ast.ExpressionNode
            ? sides.getAttribute("value")
            : sides;
        const diceRoll = this.createDiceRollValue(sides, errors);
        return Ast.Factory.create(Ast.NodeType.DiceRoll)
            .setAttribute("value", diceRoll)
            .setAttribute("drop", "no");
    }

    private createDiceRollValue(sides: Ast.ExpressionNode | number, errors: ErrorMessage[]): number {
        let minValue = 1, maxValue = 0;

        const sidesValue = sides instanceof Ast.ExpressionNode
            ? sides.getAttribute("value")
            : sides;

        if (sidesValue === "fate") {
            minValue = -1; maxValue = 1;
        } else {
            maxValue = Math.round(sides instanceof Ast.ExpressionNode ? this.evaluate(sides, errors) : sides);
        }
        return this.random.numberBetween(minValue, maxValue);
    }

    countSuccesses(expression: Ast.ExpressionNode, errors: ErrorMessage[]): number {
        // TODO: Implement successes.
        return 0;
    }

    countFailures(expression: Ast.ExpressionNode, errors: ErrorMessage[]): number {
        // TODO: Implement failures.
        return 0;
    }

    private expectChildCount(expression: Ast.ExpressionNode, count: number, errors: ErrorMessage[]) {
        const findCount = expression.getChildCount();
        if (findCount < count) {
            throw new ErrorMessage(`Expected ${expression.type} node to have ${count} children, but found ${findCount}.`, expression)
        }
    }
}
