export type InstructionLevel = "assistant" | "thread" | "none";

export type ThreadMessageRole = "assistant" | "user";
export type ChatMessageRole = ThreadMessageRole | "system";

export interface ChatMessage extends Omit<ThreadMessage, "role"> {
  role: ChatMessageRole;
  placeholder?: string;
}

export interface ThreadMessage {
  role: ThreadMessageRole;
  content: string;
}

type WithMessageBuilder = (message: MessageBuilder) => void;
type WithMessageBuilderAsync = (message: MessageBuilder) => Promise<void>;

type MessageInput = string | number | boolean | MessageBuilder;

type _Input = MessageInput | WithMessageBuilder | WithMessageBuilderAsync;

type MessageFilter = (message: {
  role: ChatMessageRole;
  content: string;
}) => Boolean;

export function prompt(
  args: {
    [key: string]: any;
  } = {}
) {
  return new PromptBuilder(args);
}

type PromptBuilderOptions = {
  addedToThread?: boolean;
  cache?: boolean;
  group?: string;
};

export class PromptBuilder {
  constructor(
    public args: {
      [key: string]: any;
    } = {}
  ) {}

  private _messages: {
    // For Claude AI
    cache?: boolean;
    addedToThread: boolean;
    role: ChatMessageRole;
    content: MessageInput;
    instructionLevel: InstructionLevel;
    instructionVersion: number;
  }[] = [];

  _push(
    message: MessageInput | WithMessageBuilder,
    role: ChatMessageRole,
    options?: PromptBuilderOptions,
    instructionLevel: InstructionLevel = "none",
    instructionVersion: number = 1
  ): PromptBuilder {
    if (typeof message === "function") {
      if (isAsyncFunction(message)) {
        throw new Error(
          `Async function cannot be used with non-async message method. Use ${role}MessageAsync instead.`
        );
      }
      const _message = msg(undefined, this.args);

      message(_message);

      this._messages.push({
        role,
        content: _message,
        cache: options?.cache,
        instructionLevel,
        instructionVersion,
        addedToThread: options?.addedToThread ?? false,
      });
      return this;
    } else if (message instanceof MessageBuilder) {
      this._messages.push({
        role,
        content: message,
        cache: options?.cache,
        instructionLevel,
        instructionVersion,
        addedToThread: options?.addedToThread ?? false,
      });
      return this;
    }

    this._messages.push({
      role,
      content: _buildTemplate(`${message}`, this.args),
      cache: options?.cache,
      instructionLevel,
      instructionVersion,
      addedToThread: options?.addedToThread ?? false,
    });
    return this;
  }

  async _pushAsync(
    message: WithMessageBuilderAsync,
    role: ChatMessageRole,
    options?: PromptBuilderOptions,
    instructionLevel: InstructionLevel = "none",
    instructionVersion: number = 1
  ): Promise<PromptBuilder> {
    const _message = msg(undefined, this.args);
    await message(_message);
    this._messages.push({
      role,
      content: _message,
      cache: options?.cache,
      instructionLevel,
      instructionVersion,
      addedToThread: options?.addedToThread ?? false,
    });
    return this;
  }

  userMessage(
    message: MessageInput,
    options?: PromptBuilderOptions
  ): PromptBuilder;
  userMessage(
    message: WithMessageBuilder,
    options?: PromptBuilderOptions
  ): PromptBuilder;

  userMessage(message: _Input, options?: PromptBuilderOptions): PromptBuilder {
    return this._push(message, "user", options);
  }

  userMessageAsync(
    message: WithMessageBuilderAsync,
    options?: PromptBuilderOptions
  ): Promise<PromptBuilder> {
    return this._pushAsync(message, "user", options);
  }

  assistantMessage(
    message: MessageInput,
    options?: PromptBuilderOptions
  ): PromptBuilder;
  assistantMessage(
    message: WithMessageBuilder,
    options?: PromptBuilderOptions
  ): PromptBuilder;

  assistantMessage(
    message: _Input,
    options?: PromptBuilderOptions
  ): PromptBuilder {
    return this._push(message, "assistant", options);
  }

  async assistantMessageAsync(
    message: WithMessageBuilderAsync,
    options?: PromptBuilderOptions
  ): Promise<PromptBuilder> {
    return this._pushAsync(message, "assistant", options);
  }

  systemMessage(
    message: MessageInput,
    instructionLevel: InstructionLevel,
    instructionVersion: number,
    options?: PromptBuilderOptions
  ): PromptBuilder;
  systemMessage(
    message: WithMessageBuilder,
    instructionLevel: InstructionLevel,
    instructionVersion: number,
    options?: PromptBuilderOptions
  ): PromptBuilder;

  systemMessage(
    message: _Input,
    instructionLevel: InstructionLevel,
    instructionVersion: number,
    options?: PromptBuilderOptions
  ): PromptBuilder {
    return this._push(
      message,
      "system",
      options,
      instructionLevel,
      instructionVersion
    );
  }

  async systemMessageAsync(
    message: WithMessageBuilderAsync,
    instructionLevel: InstructionLevel,
    instructionVersion: number,
    options?: PromptBuilderOptions
  ): Promise<PromptBuilder> {
    return this._pushAsync(
      message,
      "system",
      options,
      instructionLevel,
      instructionVersion
    );
  }

  buildForAssistant(filter?: MessageFilter): {
    messages: ThreadMessage[];
    assistantContext?: {
      text: string;
      version: number;
    };
    threadContext?: string;
  } {
    const _filter = filter ? (e: any) => filter(e) : () => true;
    const messages = this._messages.filter(_filter).map((m) => {
      if (m.content instanceof MessageBuilder) {
        const newBuilder = m.content.copyWith({
          ...this.args,
          ...m.content.args,
        });
        return {
          role: m.role,
          content: newBuilder.build().trim(),
          instructionLevel: m.instructionLevel,
          instructionVersion: m.instructionVersion,
          addedToThread: m.addedToThread,
          cache: m.cache,
        };
      }

      return {
        role: m.role,
        content: m.content.toString().trim(),
        instructionLevel: m.instructionLevel,
        instructionVersion: m.instructionVersion,
        addedToThread: m.addedToThread,
        cache: m.cache,
      };
    });
    let assistantContextParts: string[] = [];
    let assistantContextVersion: number = 1;
    let threadContextParts: string[] = [];
    let msgs: ThreadMessage[] = [];

    for (const message of messages) {
      if (message.role === "system") {
        if (message.instructionLevel === "assistant") {
          assistantContextParts.push(message.content);
          assistantContextVersion *= message.instructionVersion;
        } else if (message.instructionLevel === "thread") {
          threadContextParts.push(message.content);
        }
      } else {
        if (!message.addedToThread) {
          msgs.push({
            role: message.role,
            content: message.content.trim(),
          });
        }
      }
    }

    return {
      messages: msgs,
      assistantContext:
        assistantContextParts.length > 0
          ? {
              text: assistantContextParts.join("\n"),
              version: assistantContextVersion,
            }
          : undefined,
      threadContext:
        threadContextParts.length > 0
          ? threadContextParts.join("\n")
          : undefined,
    };
  }

  buildForClaude(
    addCache: boolean = true,
    filter?: MessageFilter
  ): {
    messages: {
      role: ThreadMessageRole;
      content:
        | string
        | {
            type: "text";
            text: string;
            cache_control?: {
              type: "ephemeral";
            };
          }[];
    }[];
    context:
      | {
          type: "text";
          text: string;
          cache_control?: {
            type: "ephemeral";
          };
        }[]
      | undefined;
  } {
    const _filter = filter ? (e: any) => filter(e) : () => true;

    const messages = this._messages.filter(_filter).map((m) => {
      if (m.content instanceof MessageBuilder) {
        const newBuilder = m.content.copyWith({
          ...this.args,
          ...m.content.args,
        });

        return {
          role: m.role,
          content: newBuilder.build().trim(),
          cache: m.cache,
          instructionLevel: m.instructionLevel,
          instructionVersion: m.instructionVersion,
        };
      }

      return {
        role: m.role,
        content: m.content.toString().trim(),
        cache: m.cache,
        instructionLevel: m.instructionLevel,
        instructionVersion: m.instructionVersion,
      };
    });

    const ctx: {
      type: "text";
      text: string;
      cache_control?: {
        type: "ephemeral";
      };
    }[] = [];

    let msgs: {
      role: ThreadMessageRole;
      content:
        | {
            type: "text";
            text: string;
            cache_control?: {
              type: "ephemeral";
            };
          }[]
        | string;
    }[] = [];

    let assistantContextParts: string[] = [];
    let threadContextParts: string[] = [];

    let cachedCount = 0;

    for (const message of messages) {
      if (message.role === "system") {
        if (message.instructionLevel === "assistant") {
          assistantContextParts.push(message.content);
        } else if (message.instructionLevel === "thread") {
          threadContextParts.push(message.content);
        }
      }
    }

    if (assistantContextParts.length > 0) {
      ctx.push({
        type: "text",
        text: assistantContextParts.join("\n"),
        cache_control: {
          type: "ephemeral",
        },
      });
    }

    if (threadContextParts.length > 0) {
      ctx.push({
        type: "text",
        text: threadContextParts.join("\n"),
        cache_control: {
          type: "ephemeral",
        },
      });
    }

    for (const message of messages) {
      if (message.role === "system") {
        // if (addCache && systemCacheCount < 4 && message.cache) {
        //   systemCacheCount++;
        //   ctx.push({
        //     type: "text",
        //     text: message.content.trim(),
        //     cache_control: {
        //       type: "ephemeral",
        //     },
        //   });
        // }
      } else {
        if (addCache && cachedCount < 4 && message.cache) {
          cachedCount++;
          msgs.push({
            role: message.role,
            content: [
              {
                type: "text",
                text: message.content.trim(),
                cache_control: {
                  type: "ephemeral",
                },
              },
            ],
          });
        } else {
          msgs.push({
            role: message.role,
            content: message.content.trim(),
          });
        }
      }
    }

    return {
      messages: msgs,
      context: ctx,
    };
  }

  build(filter?: MessageFilter): ChatMessage[] {
    const _filter = filter ? (e: any) => filter(e) : () => true;
    return this._messages.filter(_filter).map((m) => {
      if (m.content instanceof MessageBuilder) {
        const newBuilder = m.content.copyWith({
          ...this.args,
          ...m.content.args,
        });
        return {
          role: m.role,
          content: newBuilder.build().trim(),
        };
      }

      return {
        role: m.role,
        content: m.content.toString().trim(),
      };
    });
  }
}

export function msg(
  initial: string | MessageBuilder | undefined = undefined,
  args: {
    [key: string]: any;
  } = {}
) {
  const message = new MessageBuilder(null, args);
  if (initial) {
    message.add(initial);
  }
  return message;
}

export class MessageBuilder {
  constructor(
    private customIndent: string | null = null,
    public args: {
      [key: string]: any;
    } = {}
  ) {}

  private static indent = "   ";

  static setGlobalIndent(indent: string) {
    MessageBuilder.indent = indent;
  }

  private _parts: (any | MessageBuilder)[] = [];

  private get indent() {
    return this.customIndent ?? MessageBuilder.indent;
  }

  add(message: MessageInput): MessageBuilder;
  add(message: WithMessageBuilder): MessageBuilder;

  add(message: MessageInput | WithMessageBuilder) {
    if (typeof message === "function") {
      if (message instanceof Promise) {
        throw new Error("Unsupported async message. Use addAsync instead.");
      }
      const _message = msg(undefined, this.args);
      const fn = message as WithMessageBuilder;
      fn(_message);
      this._parts.push(_message);
    } else {
      this._parts.push(message);
    }
    return this;
  }

  async addAsync(fn: WithMessageBuilderAsync): Promise<MessageBuilder> {
    const _message = msg(undefined, this.args);
    await fn(_message);
    this._parts.push(_message);
    return this;
  }

  addKv(key: string, value: MessageInput): MessageBuilder;
  addKv(key: string, value: WithMessageBuilder): MessageBuilder;
  addKv(key: string, value: any) {
    if (typeof value === "function") {
      if (value instanceof Promise) {
        throw new Error("Unsupported async message. Use addKvAsync instead.");
      }
      const _message = msg(undefined, this.args);
      value(_message);
      this._parts.push(`${key}:`);
      this._parts.push(_message);
    } else if (value instanceof MessageBuilder) {
      this._parts.push(`${key}:`);
      this._parts.push(value);
    } else {
      // is message builder
      this._parts.push(`${key}: ${value}`);
    }

    return this;
  }

  async addKvAsync(
    key: string,
    fn: WithMessageBuilderAsync
  ): Promise<MessageBuilder> {
    const _message = msg(undefined, this.args);
    await fn(_message);
    this._parts.push(`${key}: ${_message}`);
    return this;
  }

  private _build(
    withIntent: boolean = false,
    indent: string | null = null,
    ignoreArgs: boolean = false
  ): string {
    const int = indent ?? this.indent;
    const parts = this._parts.map((p) => {
      let str: string | null = null;

      if (p instanceof MessageBuilder) {
        const newBuilder = p.copyWith({ ...this.args, ...p.args });
        str = newBuilder._build(true, int, ignoreArgs);
      } else {
        str = _buildTemplate(`${_stringifyValue(p)}`, this.args, ignoreArgs);
      }

      if (withIntent) {
        return str
          .split("\n")
          .map((line) => `${int}${line}`)
          .join(`\n`);
      }

      return str;
    });

    return parts.join("\n");
  }

  build(ignoreArgs: boolean = false) {
    return this._build(false, null, ignoreArgs);
  }

  toJSON() {
    return this.build();
  }

  copyWith(args: { [key: string]: any }): MessageBuilder {
    const builder = new MessageBuilder(this.customIndent, args);
    builder._parts = this._parts.map((p) => p);
    return builder;
  }

  mergeWith(args: { [key: string]: any }): MessageBuilder {
    const builder = new MessageBuilder(this.customIndent, {
      ...this.args,
      ...args,
    });
    builder._parts = this._parts.map((p) => p);
    return builder;
  }
}

function _buildTemplate(
  template: string,
  args: {
    [key: string]: any;
  },
  ignoreArgs: boolean = false
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, p1) => {
    if (p1 in args && !ignoreArgs) {
      return _stringifyValue(args[p1]);
    }
    console.warn(`Template argument "${p1}" not found in args`);
    return match;
  });
}

function _stringifyValue(val: any) {
  if (typeof val === "object") {
    return JSON.stringify(val);
  }
  return val;
}

function isAsyncFunction(fn: Function): boolean {
  return (
    fn instanceof Promise ||
    fn.constructor.name === "AsyncFunction" ||
    fn.toString().includes("async") ||
    Object.prototype.toString.call(fn) === "[object AsyncFunction]"
  );
}
