import { Meta } from "../models/_index";
import { AIModels, MsgGenerationType } from "../utils/ai-types";
import crypto from "crypto";

export class GlobalAssistantManager {
  // @ts-ignore
  private static assistants: {
    [key in MsgGenerationType]: {
      [key in AIModels]: {
        assistantId: string;
        instructionVersion: number;
        schemaVersion: number;
      };
    };
  } = {};

  public static async init() {
    const assistants = await Meta.find({
      name: {
        $regex: "^assistant-",
      },
    });

    for (const assistant of assistants) {
      const [type, model] = assistant.name.split("-").slice(1);
      const { instructionVersion, schemaVersion, assistantId } = assistant;

      if (!this.assistants[type as MsgGenerationType]) {
        // @ts-ignore
        this.assistants[type as MsgGenerationType] = {};
      }

      if (!this.assistants[type as MsgGenerationType][model as AIModels]) {
        // @ts-ignore
        this.assistants[type as MsgGenerationType][model as AIModels] = {
          assistantId: assistantId,
          instructionVersion,
          schemaVersion,
        };
      }
    }
  }

  public static getAssistant(
    type: MsgGenerationType,
    model: AIModels,
    instructionVersion: number,
    schemaVersion: number
  ): {
    assistantId: string;
    instructionVersion: number;
    schemaVersion: number;
  } | null {
    if (this.assistants[type] && this.assistants[type][model]) {
      if (
        this.assistants[type][model].instructionVersion ===
          instructionVersion &&
        this.assistants[type][model].schemaVersion === schemaVersion
      ) {
        return this.assistants[type][model];
      } else {
        Meta.deleteOne({
          name: `assistant-${type}-${model}`,
        });
      }
    }
    return null;
  }

  public static async createAssistant(args: {
    type: MsgGenerationType;
    model: AIModels;
    instructionVersion: number;
    schemaVersion: number;
    assistantId: string;
  }) {
    const assistant = await Meta.updateOne(
      {
        name: `assistant-${args.type}-${args.model}`,
      },
      {
        $set: {
          instructionVersion: args.instructionVersion,
          schemaVersion: args.schemaVersion,
          assistantId: args.assistantId,
        },
      },
      {
        upsert: true,
      }
    );

    if (!assistant) {
      throw new Error("Failed to create assistant");
    }

    return assistant;
  }
}
