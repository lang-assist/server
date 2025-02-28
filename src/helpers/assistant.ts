import { Meta } from "../models/_index";
import { BrocaTypes } from "../types";

export class GlobalAssistantManager {
  // @ts-ignore
  private static assistants: {
    [key in BrocaTypes.AI.Types.MsgGenerationType]: {
      [key: string]: BrocaTypes.AI.AIAssistant;
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

      if (!this.assistants[type as BrocaTypes.AI.Types.MsgGenerationType]) {
        // @ts-ignore
        this.assistants[type as BrocaTypes.AI.Types.MsgGenerationType] = {};
      }

      if (
        !this.assistants[type as BrocaTypes.AI.Types.MsgGenerationType][
          model as string
        ]
      ) {
        // @ts-ignore
        this.assistants[type as BrocaTypes.AI.Types.MsgGenerationType][
          model as string
        ] = {
          id: assistantId,
          version: instructionVersion,
          schemaVersion,
        };
      }
    }
  }

  public static getAssistant(
    type: BrocaTypes.AI.Types.MsgGenerationType,
    model: string
    // instructionVersion: number,
    // schemaVersion: number
  ): BrocaTypes.AI.AIAssistant | null {
    if (this.assistants[type] && this.assistants[type][model]) {
      // if (
      //   this.assistants[type][model].version === instructionVersion &&
      //   this.assistants[type][model].schemaVersion === schemaVersion
      // ) {
      //   return this.assistants[type][model];
      // } else {
      //   Meta.deleteOne({
      //     name: `assistant-${type}-${model}`,
      //   });
      // }
      return this.assistants[type][model];
    }
    return null;
  }

  public static async createAssistant(args: {
    type: BrocaTypes.AI.Types.MsgGenerationType;
    model: string;
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
