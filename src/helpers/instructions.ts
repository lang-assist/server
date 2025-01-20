import { WithId } from "mongodb";
import {
  Material,
  IMaterial,
  IJourney,
  IUserAnswer,
  ConversationTurn,
  User,
} from "../models/_index";
import { AIMessages, MaterialDetails, MaterialMetadata } from "../utils/types";
import { IUserPath } from "../models/_index";
import { ConversationDetails, PathLevel, QuizDetails } from "../utils/types";
import { PromptBuilder } from "../utils/prompt-builder";

export function summarizeMaterial(
  builder: PromptBuilder,
  material: {
    details: MaterialDetails;
    metadata: MaterialMetadata;
  }
): void {
  const parts: string[] = [
    "Material ID: " + material.metadata.id,
    "Type: " + material.details.type,
    "Title: " + material.metadata.title,
    "Focus: " + material.metadata.focusAreas.join(", "),
  ];

  switch (material.details.type) {
    case "QUIZ":
      const details = material.details as QuizDetails;

      if (details.preludes) {
        parts.push("Preludes are:\n");

        for (const prelude of details.preludes) {
          parts.push(
            `${prelude.id}: ${prelude.parts
              .map((p) => p.content || p.picturePrompt)
              .join("\n")}`
          );
          parts.push("\n");
        }

        parts.push("\n");
      }

      parts.push("Questions are:\n");

      for (const question of details.questions) {
        parts.push(`${question.id}: ${question.question}`);
        parts.push("\n");
        parts.push("Question type: " + question.type);

        if (question.choices) {
          parts.push("Choices are:\n");
          parts.push(
            question.choices.map((c) => `${c.text} (${c.id})`).join("\n")
          );
          parts.push("\n");
        }

        if (question.items) {
          parts.push("Items are:\n");
          parts.push(
            question.items.map((c) => `${c.text} (${c.id})`).join("\n")
          );
          parts.push("\n");
        }

        if (question.secondItems) {
          parts.push("Second items are:\n");
          parts.push(
            question.secondItems.map((c) => `${c.text} (${c.id})`).join("\n")
          );
          parts.push("\n");
        }
      }

      break;
    case "CONVERSATION":
      const conversation = material.details as ConversationDetails;

      parts.push("Scenario is:\n");
      parts.push(conversation.scenarioScaffold);

      parts.push("User instructions are:\n");
      parts.push(conversation.instructions);

      parts.push("Characters are:\n");
      parts.push(
        conversation.characters
          .map((c) => `   ${c.name}: ${c.description}`)
          .join("\n")
      );

      parts.push("Expected turn count approximately: " + conversation.length);

      break;
    default:
      throw new Error("Invalid material type");
  }

  builder.systemMessage(parts.join("\n"));
}

function _withIntent(intent: string, text: string) {
  if (text.includes("\n")) {
    return `\n${text
      .split("\n")
      .map((line) => `${intent}${line}`)
      .join("\n")}`;
  }

  return `${text}`;
}

async function summarizeMaterialAndAnswers(
  builder: PromptBuilder,
  material: WithId<IMaterial>,
  answer: WithId<IUserAnswer>
): Promise<void> {
  summarizeMaterial(builder, {
    details: material.details,
    metadata: material.metadata,
  });

  const parts: string[] = [];

  switch (material.details.type) {
    case "QUIZ":
      const answers = answer.answers as {
        [key: string]: string;
      };

      parts.push(`Answers for "${material.metadata.id}":`);

      for (const [key, value] of Object.entries(answers)) {
        parts.push(`Question "${key}":${_withIntent("   ", value)}`);
      }

      builder.userMessage(parts.join("\n"));

      break;
    case "CONVERSATION":
      if (material.status !== "COMPLETED") {
        throw new Error("Material is not completed");
      }

      const turns = await ConversationTurn.find({
        material_ID: material._id,
      });

      if (turns.length === 0) {
        throw new Error("Conversation has no turns");
      }

      for (const turn of turns) {
        parts.push(`- ${turn.character}: ${turn.text}`);
        if (turn.analyze) {
          parts.push("Analysis:");
          for (const [key, value] of Object.entries(turn.analyze)) {
            parts.push(`   ${key}: ${value}%`);
          }
        }
      }

      builder.userMessage(
        `Conversation "${
          material.metadata.id
        }" completed with the following turns:\n${parts.join("\n")}`
      );

      break;
    default:
      throw new Error("Invalid material type");
  }

  if (material.details.type === "CONVERSATION") {
  } else {
    builder.userMessage(
      `Answer for "${material.metadata.id}": ${JSON.stringify(answer.answers)}`
    );
  }
}

export async function summarizeAnswer(
  builder: PromptBuilder,
  answer: WithId<IUserAnswer>
): Promise<void> {
  const material = await Material.findById(answer.material_ID);

  if (!material) {
    throw new Error("Material not found");
  }

  await summarizeMaterialAndAnswers(builder, material, answer);
}

function _userCurrentStateInstructions(args: {
  userPath: WithId<IUserPath>;
  journey: WithId<IJourney>;
}) {
  if (args.userPath.type === "INITIAL") {
    return `

      `;
  }

  let learningPath: string;

  if (args.userPath.type === "PROFESSION") {
    learningPath = `The user is currently learning for professional purposes. He is a ${args.userPath.profession}.`;
  } else {
    learningPath = `The user is currently learning for general purposes.`;
  }

  return `
${learningPath}

User current level is ${_summarizePathLevel(
    args.userPath.progress.level
  )} in the current learning path.

His strong points are ${args.userPath.progress.strongPoints.join(", ")}.

His weak points are ${args.userPath.progress.weakPoints.join(", ")}.

We are some other observations about the user:

${args.userPath.progress.observations.join("\n")}

    `;
}

function _summarizePathLevel(level: PathLevel) {
  return `
    Listening: ${level.listening === -1 ? "Not started" : level.listening}
    Reading: ${level.reading === -1 ? "Not started" : level.reading}
    Speaking: ${level.speaking === -1 ? "Not started" : level.speaking}
    Writing: ${level.writing === -1 ? "Not started" : level.writing}
    Grammar: ${level.grammar === -1 ? "Not started" : level.grammar}
    Vocabulary: ${level.vocabulary === -1 ? "Not started" : level.vocabulary}
    `;
}

export async function journeyInstructions(
  builder: PromptBuilder,
  args: {
    journey: WithId<IJourney>;
    userPath: WithId<IUserPath>;
    answers?: WithId<IUserAnswer>[];
  }
): Promise<void> {
  let parts: string[] = [];

  const user = await User.findById(args.journey.user_ID);

  parts.push(`
User name is ${user?.name}. He/She is learning ${args.journey.to}.
  `);

  parts.push(
    _userCurrentStateInstructions({
      userPath: args.userPath,
      journey: args.journey,
    })
  );

  builder.systemMessage(parts.join("\n"));

  if (args.answers) {
    await Promise.all(
      args.answers.map(async (answer) => await summarizeAnswer(builder, answer))
    );
  }
}
