/**
 * A TypeScript implementation of Dart's Completer pattern.
 * This class provides a way to create a Promise and control its resolution externally.
 */
export class Completer<T> {
  private _promise: Promise<T>;
  private _resolve!: (value: T | PromiseLike<T>) => void;
  private _reject!: (reason?: any) => void;
  private _isCompleted: boolean = false;

  constructor() {
    this._promise = new Promise<T>((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  /**
   * Returns the Promise associated with this Completer.
   * This promise will be completed when either complete() or completeError() is called.
   */
  get future(): Promise<T> {
    return this._promise;
  }

  /**
   * Completes the future with the given value.
   * @param value The value to complete the future with.
   * @throws Error if the future is already completed.
   */
  complete(value: T): void {
    if (this._isCompleted) {
      throw new Error("Future already completed");
    }
    this._isCompleted = true;
    this._resolve(value);
  }

  /**
   * Completes the future with an error.
   * @param error The error to complete the future with.
   * @throws Error if the future is already completed.
   */
  completeError(error: any): void {
    if (this._isCompleted) {
      throw new Error("Future already completed");
    }
    this._isCompleted = true;
    this._reject(error);
  }

  /**
   * Returns whether the future has been completed.
   */
  get isCompleted(): boolean {
    return this._isCompleted;
  }
}

/**
 * Creates a new Completer.
 * @returns A new Completer instance.
 */
export function createCompleter<T>(): Completer<T> {
  return new Completer<T>();
}

/**
 * Example usage:
 *
 * ```typescript
 * // Create a completer
 * const completer = new Completer<string>();
 *
 * // Get the future (Promise)
 * const future = completer.future;
 *
 * // Use the future like any Promise
 *       .catch(error => console.error(`Error: ${error}`));
 *
 * // Later, complete the future
 * completer.complete('Hello, world!');
 *
 * // Or complete with an error
 * // completer.completeError(new Error('Something went wrong'));
 * ```
 */
