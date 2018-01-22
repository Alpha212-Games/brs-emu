import { BrsType } from "./";
import { BrsValue, ValueKind } from "./BrsType";
import { BrsNumber, IFloat, IDouble, IInt32, IInt64 } from "./BrsNumber";
import { Int32 } from "./Int32";
import { Double } from "./Double";
import { Int64 } from "./Int64";

export class Float implements IFloat {
    readonly kind = ValueKind.Float;
    private readonly value: number;

    getValue(): number {
        return this.value;
    }

    /**
     * Creates a new BrightScript floating-point value representing the provided `value`.
     * @param value the value to store in the BrightScript float, rounded to 32-bit floating point
     *              precision.
     */
    constructor(value: number) {
        this.value = Math.fround(value);
    }

    /**
     * Creates a new BrightScript floating-point value representing the floating point value
     * contained in `asString`.
     * @param asString the string representation of the value to store in the BrightScript float.
     *                 Will be rounded to 32-bit floating point precision.
     * @returns a BrightScript floating-point value representing `asString`.
     */
    static fromString(asString: string): Float {
        return new Float(Number.parseFloat(asString));
    }

    add(rhs: BrsNumber): BrsNumber {
        switch (rhs.kind) {
            case ValueKind.Int64:
                // TODO: Confirm that (double) + (int64) -> (double)
                return new Float(this.getValue() + rhs.getValue().toNumber());
            case ValueKind.Int32:
            case ValueKind.Float:
                return new Float(this.getValue() + rhs.getValue());
            case ValueKind.Double:
                return new Double(this.getValue() + rhs.getValue());
        }
    }

    subtract(rhs: BrsNumber): BrsNumber {
        switch (rhs.kind) {
            case ValueKind.Int64:
                // TODO: Confirm that (float) - (int64) -> (float)
                return new Float(this.getValue() - rhs.getValue().toNumber());
            case ValueKind.Int32:
            case ValueKind.Float:
                return new Float(this.getValue() - rhs.getValue());
            case ValueKind.Double:
                return new Double(this.getValue() - rhs.getValue());
        }
    }

    multiply(rhs: BrsNumber): BrsNumber {
        switch (rhs.kind) {
            case ValueKind.Int64:
                // TODO: Confirm that (float) * (int64) -> (float)
                return new Float(this.getValue() * rhs.getValue().toNumber());
            case ValueKind.Int32:
            case ValueKind.Float:
                return new Float(this.getValue() * rhs.getValue());
            case ValueKind.Double:
                return new Double(this.getValue() * rhs.getValue());
        }
    }

    divide(rhs: BrsNumber): IFloat | IDouble {
        switch (rhs.kind) {
            case ValueKind.Int64:
                // TODO: Confirm that (float) / (int64) -> (float)
                return new Float(this.getValue() / rhs.getValue().toNumber());
            case ValueKind.Int32:
            case ValueKind.Float:
                return new Float(this.getValue() / rhs.getValue());
            case ValueKind.Double:
                return new Double(this.getValue() / rhs.getValue());
        }
    }

    modulo(rhs: BrsNumber): BrsNumber {
        switch (rhs.kind) {
            case ValueKind.Int32:
            case ValueKind.Float:
                return new Float(this.getValue() % rhs.getValue());
            case ValueKind.Double:
                return new Double(this.getValue() % rhs.getValue());
            case ValueKind.Int64:
                return new Float(this.getValue() % rhs.getValue().toNumber());
        }
    }

    intDivide(rhs: BrsNumber): IInt32 | IInt64 {
        switch (rhs.kind) {
            case ValueKind.Int64:
                return new Int64(
                    Math.trunc(this.getValue() / rhs.getValue().toNumber())
                );
            case ValueKind.Int32:
            case ValueKind.Float:
            case ValueKind.Double:
                return new Int32(
                    Math.trunc(this.getValue() / rhs.getValue())
                );
        }
    }

    pow(exponent: BrsNumber): BrsNumber {
        switch (exponent.kind) {
            case ValueKind.Int32:
                return new Float(
                    Math.pow(this.getValue(), exponent.getValue())
                );
            case ValueKind.Int64:
                return new Float(
                    Math.pow(this.getValue(), exponent.getValue().toNumber())
                );
            case ValueKind.Float:
                return new Float(
                    Math.pow(this.getValue(), exponent.getValue())
                );
            case ValueKind.Double:
                return new Double(
                    Math.pow(this.getValue(), exponent.getValue())
                );
        }
    }

    lessThan(other: BrsType): boolean {
        switch (other.kind) {
            case ValueKind.Int64:
                return this.getValue() < other.getValue().toNumber();
            case ValueKind.Int32:
            case ValueKind.Float:
                return this.getValue() < other.getValue();
            case ValueKind.Double:
                return new Double(this.getValue()).lessThan(other);
            default:
                return false;
        }
    }

    greaterThan(other: BrsType): boolean {
        switch (other.kind) {
            case ValueKind.Int64:
                return this.getValue() > other.getValue().toNumber();
            case ValueKind.Int32:
            case ValueKind.Float:
                return this.getValue() > other.getValue();
            case ValueKind.Double:
                return new Double(this.getValue()).greaterThan(other);
            default:
                return false;
        }
    }

    equalTo(other: BrsType): boolean {
        switch (other.kind) {
            case ValueKind.Int64:
                return this.getValue() === other.getValue().toNumber();
            case ValueKind.Int32:
            case ValueKind.Float:
                return this.getValue() === other.getValue();
            case ValueKind.Double:
                return new Double(this.getValue()).equalTo(other);
            default:
                return false;
        }
    }

    toString(): string {
        return this.value.toString();
    }
}