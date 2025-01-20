import { AIMessage } from "./types";

export class PromptBuilder {
  private _messages: AIMessage[] = [];

  // addMessage(message: AIMessage) {
  //   this._messages.push(message);
  // }

  userMessage(message: string) {
    this._messages.push({
      role: "user",
      content: message,
    });
  }

  assistantMessage(message: string) {
    this._messages.push({
      role: "assistant",
      content: message,
    });
  }

  systemMessage(message: string) {
    this._messages.push({
      role: "system",
      content: message,
    });
  }

  buildForAssistant(): {
    messages: {
      role: "user" | "assistant";
      content: string;
    }[];
    additionalContext: string | undefined;
  } {
    const systemMessages = this._messages.filter((m) => m.role === "system");
    const otherMessages = this._messages.filter((m) => m.role !== "system");

    return {
      messages: otherMessages as any,
      additionalContext:
        systemMessages.length > 0
          ? systemMessages.map((e) => e.content).join("\n")
          : undefined,
    };
  }

  build(): AIMessage[] {
    return this._messages;
  }
}
