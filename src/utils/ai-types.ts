import { ValidationError } from "jsonschema";

export class AIError extends Error {
  constructor(
    message: string,
    public eventId: string | null = null,
    public additional: any = null
  ) {
    super(message);
    this.name = "AIError";
  }

  toJSON() {
    return {
      message: this.message,
      eventId: this.eventId,
      additional: this.additional,
    };
  }
}

export class MultipleAIError extends AIError {
  constructor(
    message: string,
    public errors: AIError[],
    public eventId: string | null = null
  ) {
    super(message, eventId);
    this.name = "MultipleAIError";
  }

  toJSON() {
    return {
      ...super.toJSON(),
      errors: this.errors,
    };
  }
}

export class AIInvalidSchemaError extends AIError {
  constructor(
    message: string,
    public schema: any,
    public thisResponse: any,
    public validationErrors: ValidationError[],
    eventId: string | null = null
  ) {
    super(message, eventId);
    this.name = "AIInvalidSchemaError";
  }

  toJSON() {
    return {
      ...super.toJSON(),
      schema: this.schema,
      thisResponse: this.thisResponse,
      validationErrors: this.validationErrors,
    };
  }
}

export class AIRateLimitError extends AIError {
  constructor(
    message: string,
    public tryAgainAt: number,
    eventId: string | null = null
  ) {
    super(message, eventId);
    this.name = "AIRateLimitError";
  }

  toJSON() {
    return {
      ...super.toJSON(),
      tryAgainAt: this.tryAgainAt,
    };
  }
}
