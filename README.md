# dice-typescript [![NPM version](https://badge.fury.io/js/dice-typescript.svg)](http://badge.fury.io/js/dice-typescript)

[![Build Status](https://travis-ci.org/trwolfe13/dice-typescript.svg?branch=master)](https://travis-ci.org/trwolfe13/dice-typescript) [![Codacy Badge](https://api.codacy.com/project/badge/Grade/31dad84d91994a0b9dfafb2505db9bc1)](https://www.codacy.com/app/trwolfe13/dice-typescript?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=trwolfe13/dice-typescript&amp;utm_campaign=Badge_Grade) [![Codacy Badge](https://api.codacy.com/project/badge/Coverage/31dad84d91994a0b9dfafb2505db9bc1)](https://www.codacy.com/app/trwolfe13/dice-typescript?utm_source=github.com&utm_medium=referral&utm_content=trwolfe13/dice-typescript&utm_campaign=Badge_Coverage)

A TypeScript library for parsing dice rolling expressions, most commonly used in tabletop RPGs.

## Getting Started

### Usage

#### Basic Usage

At its simplest, the dice roller is very simple to use. Take the following example:

```typescript
import { Dice } from "https://raw.githubusercontent.com/open5e-deno/dice-typescript/master/src/mod.ts";

const dice = new Dice();
const result = dice.roll("1d20").total;
console.log(result); // Outputs a random number between 1 and 20.
```

The ```roll(expression: string)``` method  returns a ```DiceResult``` object that, aside from the total of the roll, also includes the number of passes/fails that were rolled (if pass and fail conditions were specified). Finally, it also provides an expanded model of the results for each die roll, for any required breakdown.

#### Modifying Behavior

The ```Dice``` class has several methods that can be overridden in order to modify the construction of the lexer/parser/interpreter/generator:

```typescript
// Used to control the breaking down of a string into tokens: (4d10) = LPAREN, NUMBER, DICE, NUMBER, RPAREN, etc.
protected createLexer(input: string | CharacterStream): Lexer;

// Used to control the construction of a stream of tokens into an abstract syntax tree.
protected createParser(lexer: Lexer): Parser;

// Used to actually process an abstract syntax tree, perform the appropriate dice rolls and figure out successes/failures.
protected createInterpreter(): DiceInterpreter;

// Used to control how an expression is 'rendered', that is, how an abstract syntax tree is converted back into a string.
protected createGenerator(): DiceGenerator;
```

Overriding any of the above methods will allow you to control the exact instance that is created for each part of the interpreting process.

#### Custom Functions

In addition to the ```abs```, ```ceil```, ```floor```, ```round``` and ```sqrt``` functions, the Dice library also supports adding definitions for custom functions, such as the example below:

```typescript
const customFunctions = new FunctionDefinitionList();
customFunctions["floor"] = (interpreter: DiceInterpreter, functionNode: ExpressionNode, errors: ErrorMessage[]): number => {
  return Math.floor(interpreter.evaluate(functionNode.getChild(0), errors));
}

const dice = new Dice(customFunctions);
const result = dice.roll("floor(1d20 / 2)").total;
console.log(result); // Outputs a random number between 1 and 20, divided by 2, then rounded down.
```

#### Random Provider

By default, the Dice library uses [random-js](https://www.npmjs.com/package/random-js) to generate random numbers. In some instances, this may not be suitable, so this can be enhanced by a custom implementation of the ```RandomProvider``` interface as in the example below:

```typescript
export class CustomRandom implements RandomProvider {
  numberBetween(min: number, max: number) {
    return 4; // chosen by fair dice roll.
              // guaranteed to be random.
  }
}

const dice = new Dice(null, new CustomRandom());
const result = dice.roll("1d20").total;
console.log(result); // Outputs 4.
```

#### Limiting the number of rolls or sides

Limit the number of rolls or dice sides by providing a configuration object to the `Dice` constructor:

```typescript
const dice = new Dice(null, null, {
    maxRollTimes: 20, // limit to 20 rolls 
    maxDiceSides: 100, // limit to 100 dice faces
});
const result1 = dice.roll("50d10");
console.log(result1.errors); // Outputs ["Invalid number of rolls: 50. Maximum allowed: 20."]
const result2 = dice.roll("10d500");
console.log(result2.errors); // Outputs ["Invalid number of dice sides: 500. Maximum allowed: 500."]
```

#### Dice Expression Syntax

The dice rolling syntax is based on the system used by Roll20, a detailed explanation of which can be found on the [Roll20 Wiki](https://wiki.roll20.net/Dice_Reference#Roll20_Dice_Specification).

In addition to the above syntax rules, some slightly more complicated variations are available. For example, you can roll a variable number of dice using an expression similar to the following:

```dice
  (4d4)d20
```

##### Conditional Operators

As per the Roll20 syntax, you can use conditional operators, such as in ```4d20>10```, but in this library, the semantics of those operators is slightly different. In the Roll20 engine, ```>10``` actually means ```>=10```, but in this library, you would need to actually use the ```>=``` operator. I feel needing to use the correct mathematical operators makes for a more intuitive library.

##### Group Repeaters

Sometimes it is necessary to roll complex groups of dice that aren't supported by the basic syntax. For example, rolling a saving throw at disadvantage for 10 creatures. For this, you can use the group repeater modifier, which works like this:

```dice
  {2d20kl...10}>=14
```

The above will roll 10 disadvantaged saving throws, reporting successes for those that break DC14.

##### Fractional Dice Rolls

Using the allowed syntax, it is possible to request a fractional number of dice to be rolled. Take the following example:

```dice
  (2 / 5)d6
```

In this instance, the number of dice to be rolled will be rounded to the nearest integer (2.5 gets rounded up to 3).

This will first roll ```4d4``` dice, and use the outcome of that to determine how many ```d20``` dice will be rolled.

## Installing Dependencies

Installing the dependencies is done using a standard ```npm i```.

## Running the Tests

```dice
npm run test
```

## Building the project

```dice
npm run build
```

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/trwolfe13/dice-typescript/tags).

## Authors

* **Tom Wolfe** - *Initial work* - [trwolfe13](https://github.com/trwolfe13)

See also the list of [contributors](https://github.com/trwolfe13/dice-typescript/contributors) who participated in this project.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details
