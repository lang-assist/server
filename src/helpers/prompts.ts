import fs from "fs";
import path from "path";
import { WithId } from "mongodb";
import {
  IConversationTurn,
  IJourney,
  IUser,
  IUserAnswer,
  Material,
} from "../models/_index";
import { IMaterial } from "../models/_index";
import { BrocaTypes } from "../types";
import { msg } from "../utils/prompter";
import { BaseMaterialTypeHelper } from "./gen/materials/type-helpers";

function readInstruction(file: string) {
  const filePath = path.join(__dirname, "..", "..", "tools", "combined", file);
  let fileContent = fs.readFileSync(filePath, "utf8");

  return fileContent;
}

const MaterialGenerationVersion = 3;

export const instructions = {
  conversation_turn: {
    content: msg(readInstruction("conversation_turn.md")),
    version: 1,
  },
  conversation: {
    content: msg(readInstruction("conversation.md")),
    version: MaterialGenerationVersion,
  },
  dictionary: {
    content: msg(readInstruction("dictionary.md")),
    version: 1,
  },
  documentation: {
    content: msg(readInstruction("documentation.md")),
    version: 1,
  },
  feedback: {
    content: msg(readInstruction("feedback.md")),
    version: 1,
  },
  linguistic_units: {
    content: msg(readInstruction("linguistic_units.md")),
    version: 1,
  },
  progress: {
    content: msg(readInstruction("progress.md")),
    version: 1,
  },
  quiz: {
    content: msg(readInstruction("quiz.md")),
    version: MaterialGenerationVersion,
  },
  story: {
    content: msg(readInstruction("story.md")),
    version: MaterialGenerationVersion,
  },
};

export function describeMaterial(material: WithId<IMaterial>) {
  const message = msg();
  message.addKv("Type", material.details.type);
  message.addKv("Title", material.metadata.title);
  message.addKv("Description", material.metadata.description);
  message.addKv("Focus Areas", material.metadata.focusAreas.join(", "));
  message.addKv("Focus Skills", material.metadata.focusSkills.join(", "));

  const details = BaseMaterialTypeHelper.describeDetails(material.details);

  message.addKv("Details", details);

  return message;
}

export function describeAnswer(
  type: BrocaTypes.Material.MaterialType,
  answer: WithId<IUserAnswer>
) {
  const message = msg();
  message.addKv("Answer", BaseMaterialTypeHelper.describeAnswer(type, answer));
  return message;
}

export function describeMaterialAnswer(
  material: WithId<IMaterial>,
  answer: WithId<IUserAnswer>
) {
  const message = msg();
  message.addKv("Material", describeMaterial(material));
  message.addKv("Answer", describeAnswer(material.details.type, answer));
  return message;
}

export function summarizeMaterialFocus(material: WithId<IMaterial>) {
  const message = msg();

  message.addKv("Title", material.metadata.title);
  message.addKv("Description", material.metadata.description);
  message.addKv("Skills", material.metadata.focusSkills.join(", "));
  message.addKv("Areas", material.metadata.focusAreas.join(", "));

  return message;
}

export async function journeySummary(
  journey: WithId<IJourney>,
  user: WithId<IUser>,
  pathID: string,
  includeLastMaterials: boolean,
  includeProgress: boolean
) {
  const journeySummary = msg();

  journeySummary.add(
    `The user ${user.name} is learning ${journey.to} language.`
  );

  const initial = journey.paths[pathID].type === "INITIAL";

  if (!initial) {
    if (includeProgress) {
      journeySummary.addKv("Progress", (progressMsg) => {
        const levels = journey.progress.level;
        const levelsMsg = msg();
        for (const [key, value] of Object.entries(levels)) {
          if (value < 0) {
            levelsMsg.addKv(key, "Unknown");
          } else {
            levelsMsg.addKv(key, `${value}%`);
          }
        }
        progressMsg.addKv("Levels", levelsMsg);

        progressMsg.addKv("Observations", (obs) => {
          const observations = journey.progress.observations;
          for (const observation of observations) {
            obs.add(msg(observation));
          }
        });

        progressMsg.addKv("Weak Points", (weaknesses) => {
          const weakPoints = journey.progress.weakPoints;
          for (const weakPoint of weakPoints) {
            weaknesses.add(msg(weakPoint));
          }
        });

        progressMsg.addKv("Strong Points", (strengths) => {
          const strongPoints = journey.progress.strongPoints;
          for (const strongPoint of strongPoints) {
            strengths.add(msg(strongPoint));
          }
        });
      });
    }

    if (includeLastMaterials) {
      const lastMaterials = await Material.find(
        {
          journey_ID: journey._id,
          path_ID: pathID,
        },
        {
          sort: {
            createdAt: -1,
          },
          limit: 10,
        }
      );

      const count = lastMaterials.length;
      journeySummary.addKv(`Last ${count} materials focus`, (materialsMsg) => {
        for (let i = 0; i < count; i++) {
          materialsMsg.addKv(
            `${i + 1}. ${lastMaterials[i].metadata.title}`,
            summarizeMaterialFocus(lastMaterials[i])
          );
        }
      });
    }
  } else {
    journeySummary.add(
      "User not started the learning yet. We don't have any information about him. So we will start with the initial test."
    );
  }

  return journeySummary;
}

export function summarizeConversationTurn(turn: WithId<IConversationTurn>) {
  const message = msg();
  message.addKv("Turn", turn.text);
  return message;
}

// export function initialMaterialGenerationPrompt(
//   builder: PromptBuilder,
//   metadata: BrocaTypes.Material.MaterialMetadata
// ): void {
//   //   builder.systemMessage(
//   //     "User not started the learning yet. We don't have any information about him. So we will start with the initial test.",
//   //     {
//   //       extra: {
//   //         tags: [PromptTags.PATH],
//   //       },
//   //     }
//   //   );
//   //   if (level === 3) {
//   //     builder.systemMessage(
//   //       `
//   // In itial test we need 2 materials:
//   // 1. QUIZ: a quiz with only 2 questions: TEXT_INPUT_WRITE, RECORD.
//   // 2. CONVERSATION: A conversation material for medium level.
//   // With the materials we will get the user's general lanugage skills. We leave a free field because we do not know the user's level. It will also create a background for the materail we will create for the user later. Pretend that the learning process is between 40% and 60%
//   //       `,
//   //       {
//   //         extra: {
//   //           tags: [PromptTags.MATERIAL],
//   //         },
//   //       }
//   //     );
//   //   } else if (level === 2) {
//   //     builder.systemMessage(
//   //       `
//   // We asked questions before but user didn't understand them:
//   //       `,
//   //       {
//   //         extra: {
//   //           tags: [PromptTags.MATERIAL],
//   //         },
//   //       }
//   //     );
//   //     unanderstoodQuestions
//   //       .filter((q) => q.level === 3)
//   //       .forEach((q) => summarizeMaterial(builder, q as any));
//   //     builder.systemMessage(
//   //       `
//   // We need to create a new quiz and conversation for the user:
//   // 1. QUIZ: A quiz with more simple questions(5 questions) than the ones above.
//   // 2. CONVERSATION: A conversation for more basic dialogue.
//   // These materials for should be beginner-medium level. The user may not know even the simplest words. Pretend that the learning process is between 20% and 40%
//   //         `,
//   //       {
//   //         extra: {
//   //           tags: [PromptTags.MATERIAL],
//   //         },
//   //       }
//   //     );
//   //   } else {
//   //     builder.systemMessage(
//   //       `
//   // We asked questions before but user didn't understand them:
//   //       `,
//   //       {
//   //         extra: {
//   //           tags: [PromptTags.MATERIAL],
//   //         },
//   //       }
//   //     );
//   //     unanderstoodQuestions
//   //       .filter((q) => q.level > 1)
//   //       .forEach((q) => summarizeMaterial(builder, q as any));
//   //     builder.systemMessage(
//   //       `
//   // We need to create a new quiz for the user, which will be easier than above quizzes:
//   // 1. QUIZ: A quiz with more simple questions(~5-10 questions) than the ones above. The user may not know even the simplest words.Pretend that the learning process is between 0% and 10%
//   // NOTE: Before we created a conversation for the user. Now we don't need it because the user level is too low. DONT create a conversation.
//   //       `,
//   //       {
//   //         extra: {
//   //           tags: [PromptTags.MATERIAL],
//   //         },
//   //       }
//   //     );
//   //   }
// }

// export function summarizeMaterialMeta(
//   materialId: ObjectId | undefined,
//   type: BrocaTypes.Material.MaterialType,
//   metadata: BrocaTypes.Material.MaterialMetadata
// ): string {
//   const message = msg();

//   if (materialId) {
//     message.addKv("ID", `${metadata.id} (${materialId.toString()})`);
//   } else {
//     message.addKv("ID", metadata.id);
//   }

//   message.addKv("Type", type);
//   message.addKv("Title", metadata.title);
//   message.addKv("Focus Areas", metadata.focusAreas.join(", "));
//   message.addKv("Focus Skills", metadata.focusSkills.join(", "));

//   return message.build();
// }

// export function summarizeMaterial(
//   builder: PromptBuilder,
//   material: {
//     _id?: ObjectId;
//     details: BrocaTypes.Material.MaterialDetails;
//     metadata: BrocaTypes.Material.MaterialMetadata;
//   }
// ): void {
//   // const message = msg(
//   //   summarizeMaterialMeta(
//   //     material._id,
//   //     material.details.type,
//   //     material.metadata
//   //   )
//   // );
//   // message.addKv("Details", (detailsMsg) => {
//   //   switch (material.details.type) {
//   //     case "QUIZ":
//   //       const details = material.details as QuizDetails;
//   //       if (details.preludes) {
//   //         detailsMsg.addKv("Preludes are:", (preludesMsg) => {
//   //           for (const prelude of details.preludes!) {
//   //             preludesMsg.addKv("ID", prelude.id);
//   //             for (const part of prelude.parts) {
//   //               preludesMsg.add(msg(part.content || part.picturePrompt || ""));
//   //             }
//   //           }
//   //         });
//   //       }
//   //       detailsMsg.addKv("Questions are", (questionMsg) => {
//   //         for (const question of details.questions) {
//   //           questionMsg.addKv(`Question "${question.id}"`, question.question);
//   //           questionMsg.addKv("Type", question.type);
//   //           if (question.choices) {
//   //             questionMsg.addKv("Choices", (choicesMsg) => {
//   //               for (const choice of question.choices!) {
//   //                 choicesMsg.addKv(choice.id, choice.text);
//   //                 if (choice.picturePrompt) {
//   //                   choicesMsg.add(msg(choice.picturePrompt));
//   //                 }
//   //               }
//   //             });
//   //           }
//   //           if (question.items) {
//   //             questionMsg.addKv("Items", (itemsMsg) => {
//   //               for (const item of question.items!) {
//   //                 itemsMsg.addKv(item.id, item.text);
//   //                 if (item.picturePrompt) {
//   //                   itemsMsg.add(msg(item.picturePrompt));
//   //                 }
//   //               }
//   //             });
//   //           }
//   //           if (question.secondItems) {
//   //             questionMsg.addKv("Second items", (secondItemsMsg) => {
//   //               for (const item of question.secondItems!) {
//   //                 secondItemsMsg.addKv(item.id, item.text);
//   //                 if (item.picturePrompt) {
//   //                   secondItemsMsg.add(msg(item.picturePrompt));
//   //                 }
//   //               }
//   //             });
//   //           }
//   //         }
//   //       });
//   //       break;
//   //     case "CONVERSATION":
//   //       const conversation = material.details as ConversationDetails;
//   //       detailsMsg.addKv("Scenario", conversation.scenarioScaffold);
//   //       detailsMsg.addKv("User instructions", conversation.instructions);
//   //       detailsMsg.addKv("Characters", (charactersMsg) => {
//   //         for (const character of conversation.characters) {
//   //           charactersMsg.addKv(character.name, msg(character.description));
//   //         }
//   //       });
//   //       detailsMsg.addKv("Expected turn count", conversation.length);
//   //       break;
//   //     default:
//   //       throw new Error("Invalid material type");
//   //   }
//   // });
//   // builder.assistantMessage(message, {
//   //   extra: {
//   //     tags: [PromptTags.MATERIAL],
//   //   },
//   // });
// }

// async function summarizeMaterialAndAnswers(
//   builder: PromptBuilder,
//   material: WithId<IMaterial>,
//   answer: WithId<IUserAnswer>
// ): Promise<void> {
//   // summarizeMaterial(builder, {
//   //   _id: material._id,
//   //   details: material.details,
//   //   metadata: material.metadata,
//   // });
//   // const message = msg("Answers for material {{materialId}}:", {
//   //   materialId: material.metadata.id,
//   // });
//   // await message.addAsync(async (detailsMsg) => {
//   //   switch (material.details.type) {
//   //     case "QUIZ":
//   //       const answers = answer.answers as {
//   //         [key: string]: string;
//   //       };
//   //       for (const [key, value] of Object.entries(answers)) {
//   //         detailsMsg.addKv(`"${key}"`, `${JSON.stringify(value)}`);
//   //       }
//   //       break;
//   //     case "CONVERSATION":
//   //       if (material.status !== "COMPLETED") {
//   //         throw new Error("Material is not completed");
//   //       }
//   //       const turns = await ConversationTurn.find({
//   //         material_ID: material._id,
//   //       });
//   //       if (turns.length === 0) {
//   //         throw new Error("Conversation has no turns");
//   //       }
//   //       detailsMsg.addKv(
//   //         `Conversation completed with the following turns`,
//   //         (turnsMsg) => {
//   //           for (const turn of turns) {
//   //             if (turn.character === "$user" && turn.analyze) {
//   //               turnsMsg.addKv("- $user", (userMsg) => {
//   //                 userMsg.addKv("Transcription", turn.text);
//   //                 userMsg.addKv("Analysis", (analysisMsg) => {
//   //                   for (const [key, value] of Object.entries(turn.analyze!)) {
//   //                     analysisMsg.addKv(`${key}`, `${value}%`);
//   //                   }
//   //                 });
//   //               });
//   //             } else {
//   //               turnsMsg.addKv(`- ${turn.character}`, turn.text);
//   //             }
//   //           }
//   //         }
//   //       );
//   //       break;
//   //     default:
//   //       throw new Error("Invalid material type");
//   //   }
//   // });
//   // builder.userMessage(message, {
//   //   extra: {
//   //     tags: [PromptTags.MATERIAL],
//   //   },
//   // });
// }

// export async function summarizeLast10Materials(
//   builder: PromptBuilder,
//   pathId: ObjectId
// ) {
//   // const materials = await Material.find(
//   //   {
//   //     path_ID: pathId,
//   //   },
//   //   {
//   //     sort: {
//   //       createdAt: -1,
//   //     },
//   //     limit: 10,
//   //   }
//   // );
//   // const message = msg();
//   // message.addKv("Last 10 materials", (materialsMsg) => {
//   //   for (const material of materials) {
//   //     materialsMsg.addKv(
//   //       material._id.toString(),
//   //       summarizeMaterialMeta(
//   //         material._id,
//   //         material.details.type,
//   //         material.metadata
//   //       )
//   //     );
//   //   }
//   // });
//   // builder.assistantMessage(message, {
//   //   extra: {
//   //     tags: [PromptTags.MATERIAL],
//   //   },
//   //   cache: false,
//   // });
// }

// export async function summarizeAnswer(
//   builder: PromptBuilder,
//   answer: WithId<IUserAnswer>
// ): Promise<void> {
//   const material = await Material.findById(answer.material_ID);

//   if (!material) {
//     throw new Error("Material not found");
//   }

//   await summarizeMaterialAndAnswers(builder, material, answer);
// }

// function _userJourneyInstructions(
//   builder: PromptBuilder,
//   asSystem: boolean = true
// ) {
//   // const message = msg();
//   // message.addKv("User name", "{{userName}}");
//   // message.addKv("Journey to learning", "{{language}}");
//   // if (asSystem) {
//   //   builder.systemMessage(message, {
//   //     cache: true,
//   //   });
//   // } else {
//   //   builder.assistantMessage(message, {
//   //     extra: {
//   //       tags: [PromptTags.JOURNEY],
//   //     },
//   //     cache: true,
//   //   });
//   // }
// }

// function _userCurrentStateInstructions(
//   builder: PromptBuilder,
//   journey: WithId<IJourney>,
//   asSystem: boolean = true
// ): void {
//   // const message = msg();
//   // switch (userPath.type) {
//   //   case "PROFESSION":
//   //     message.add(
//   //       `The user is currently learning for professional purposes. He is a ${userPath.profession}.`
//   //     );
//   //     break;
//   //   case "GENERAL":
//   //     message.add(`The user is currently learning for general purposes.`);
//   //     break;
//   //   case "INITIAL":
//   //     message.add(
//   //       `The user is currently not started learning. We don't know anything about him/her.`
//   //     );
//   //     break;
//   // }
//   // const progress = userPath.progress;
//   // if (progress) {
//   //   const level = progress.level ?? {};
//   //   if (
//   //     Object.keys(level).filter((key) => level[key as keyof PathLevel] !== -1)
//   //       .length > 0
//   //   ) {
//   //     message.add("User current level is:");
//   //     for (const key in level) {
//   //       if (level[key as keyof PathLevel] !== -1) {
//   //         message.add(msg(`${key}: ${level[key as keyof PathLevel]}`));
//   //       }
//   //     }
//   //   }
//   //   if (progress.strongPoints && progress.strongPoints.length > 0) {
//   //     message.add("User strong points are:");
//   //     for (const point of progress.strongPoints) {
//   //       message.add(msg(`${point}`));
//   //     }
//   //   }
//   //   if (progress.weakPoints && progress.weakPoints.length > 0) {
//   //     message.add("User weak points are:");
//   //     for (const point of progress.weakPoints) {
//   //       message.add(msg(`${point}`));
//   //     }
//   //   }
//   //   if (progress.observations && progress.observations.length > 0) {
//   //     message.add("Our observations are:");
//   //     for (const observation of progress.observations) {
//   //       message.add(msg(`${observation}`));
//   //     }
//   //   }
//   // }
//   // if (asSystem) {
//   //   builder.systemMessage(message, {
//   //     extra: {
//   //       tags: [PromptTags.PATH],
//   //     },
//   //     cache: false,
//   //   });
//   // } else {
//   //   builder.assistantMessage(message, {
//   //     extra: {
//   //       tags: [PromptTags.PATH],
//   //     },
//   //     cache: false,
//   //   });
//   // }
// }

// export async function materialGenInstructions(
//   builder: PromptBuilder,
//   metadata: BrocaTypes.Material.MaterialMetadata
// ): Promise<void> {
//   // builder.systemMessage(instructions.main, {
//   //   extra: {
//   //     tags: [PromptTags.MAIN],
//   //   },
//   //   cache: true,
//   // });
//   // builder.systemMessage(instructions.ssml, {
//   //   extra: {
//   //     tags: [PromptTags.MAIN],
//   //   },
//   //   cache: true,
//   // });
//   // const voicesMsg = await DocumentationManager.getTenVoiceMessage(
//   //   args.journey.to
//   // );
//   // builder.assistantMessage(voicesMsg, {
//   //   extra: {
//   //     tags: [PromptTags.MAIN],
//   //   },
//   //   cache: false,
//   // });
//   // _userJourneyInstructions(builder);
//   // _userCurrentStateInstructions(builder, ctx.path);
//   // await summarizeLast10Materials(builder, ctx.path._id);
//   // if (ctx.userAnswer) {
//   //   await summarizeAnswer(builder, ctx.userAnswer);
//   // }
// }

// export async function conversationCharactersInstructions(args: {
//   conversation: WithId<IMaterial>;
// }): Promise<MessageBuilder> {
//   // const conversationCharacters = (
//   //   args.conversation.details as ConversationDetails
//   // ).characters;

//   // const voices = (args.conversation.details as ConversationDetails).voices;

//   // if (!voices) {
//   //   throw new Error("Voices not found. Select voices for conversation.");
//   // }

//   // const charactersInstructionsResult = await Promise.all(
//   //   Object.entries(voices).map(async ([key, value]) => {
//   //     const voice = await Voices.findById(new ObjectId(value));
//   //     if (!voice) {
//   //       throw new Error("Voice not found");
//   //     }

//   //     const character = conversationCharacters.find((c) => c.name === key);
//   //     if (!character) {
//   //       throw new Error("Character not found");
//   //     }

//   //     return {
//   //       [key]: AIEmbeddingGenerator.voiceInstructions(voice, {
//   //         overrideSingleLocale: character.locale,
//   //         withStyles: true,
//   //         withShortName: true,
//   //         withPersonalities: false,
//   //         withSecondaryLocales: false,
//   //         withTailoredScenarios: false,
//   //       }),
//   //     };
//   //   })
//   // );

//   // const charactersInstructions: {
//   //   [key: string]: MessageBuilder;
//   // } = Object.assign({}, ...charactersInstructionsResult);

//   // const conversationMsg = msg();

//   // conversationMsg.addKv(
//   //   "We select voices for conversation characters:",
//   //   (detailsMsg) => {
//   //     for (const [key, value] of Object.entries(charactersInstructions)) {
//   //       detailsMsg.addKv(`${key}`, value);
//   //     }
//   //   }
//   // );

//   // return conversationMsg;
//   return msg();
// }

// export function conversationGenInstructions(
//   builder: PromptBuilder,
//   args: {
//     conversation: WithId<IMaterial>;
//     journey: WithId<IJourney>;
//     charactersMsg: MessageBuilder;
//   }
// ) {
//   // builder.systemMessage(instructions.conversation, {
//   //   extra: {
//   //     tags: [PromptTags.MAIN],
//   //   },
//   //   cache: true,
//   // });
//   // builder.systemMessage(instructions.ssml, {
//   //   extra: {
//   //     tags: [PromptTags.MAIN],
//   //   },
//   //   cache: true,
//   // });
//   // _userJourneyInstructions(builder, false);
//   // _userCurrentStateInstructions(builder, args.userPath, false);
//   // summarizeMaterial(builder, {
//   //   details: args.conversation.details,
//   //   metadata: args.conversation.metadata,
//   // });
//   // builder.assistantMessage(args.charactersMsg, {
//   //   extra: {
//   //     tags: [PromptTags.MATERIAL],
//   //   },
//   // });
// }

// export function linguisticUnitSetInstructions(builder: PromptBuilder) {
//   // builder.systemMessage(instructions.terms, {
//   //   extra: {
//   //     tags: [PromptTags.MAIN],
//   //   },
//   //   cache: true,
//   // });
// }

// //   return `
// // # Language Learning Assistant

// // You are an advanced language learning assistant specialized in personalized education. Your primary goal is to help users learn ${language} through learning material generation and progress analysis.

// // ## CORE RESPONSIBILITIES:

// // ### LEARNING MATERIAL GENERATION
// //    Input: User level, goals, observations, weak points, strengths, previous answers/behaviors, and learning material requirements
// //    Output: Learning material in specified JSON format
// //    Material Types:
// //    - Stories: Narratives to test/improve reading and listening comprehension
// //    - Conversations: Dialogues to practice real-world language usage
// //    - Quizzes: Questions to measure specific language skills
// //    - Exercises: Activities to practice specific grammar rules or vocabulary
// //    Tasks:
// //    - Create material following specified schema
// //    - Include appropriate metadata and focusAreas
// //    - Ensure each question/task measures specific language skills
// //    - Match material to current language level
// //    - Focus on practical language usage scenarios

// // ### PROGRESS TRACKING
// //    Input: User responses to material
// //    Output: Language skill assessment, weak points, strengths and observations
// //    Tasks:
// //    - Evaluate responses for language accuracy
// //    - Track specific skill improvements
// //    - Record grammar and vocabulary mastery
// //    - Monitor pronunciation progress
// //    - Note common language mistakes
// //    - Focus ONLY on language-related progress

// // ## MATERIAL GUIDELINES:

// // ### Every material MUST measure or improve specific language skills.

// // ### Material Requirements:
// //    - All focusAreas must be language learning related
// //    - NO personal preference questions (e.g., favorite color)
// //    - NO general knowledge questions unrelated to language
// //    - NO questions that don't measure or improve language skills
// //    - Questions should not include answers. Unnecessary clues should not be given.
// //    - Material should be appropriate for the user's level
// //    - Materials should have pictures when relevant. Use pictures to enhance learning.

// // ### RESPONSE FORMAT:
// // 1. Follow the exact JSON schema provided
// // 2. Include specific focusAreas in metadata
// // 3. Return ONLY the requested data
// // 4. NO additional messages or explanations
// // 5. NO markdown or formatting
// // 6. NO pleasantries or conversation
// // 7. Use ONLY ${language}

// // ### QUALITY GUIDELINES:
// // 1. Language Accuracy: Ensure correct grammar and natural usage
// // 2. Level-Appropriate: Match material to current language level
// // 3. Practical Focus: Emphasize real-world language use
// // 4. Measurable Outcomes: All tasks must evaluate definable language skills

// // ### MATERIAL CREATION GUIDELINES

// // Each material must have proper \`metadata\` and \`details\` following these structures:

// // #### METADATA REQUIREMENTS:
// // - \`title\`: Clear, descriptive title
// // - \`description\`: Brief explanation of material purpose
// // - \`estimatedDuration\`: Estimated completion time in minutes
// // - \`focusAreas\`: Array of specific language skills being measured/improved
// // - \`tags\`: Additional categorization tags

// // #### MATERIAL TYPES AND REQUIREMENTS:

// // ##### 1. QUIZ
// //    Purpose: Measure specific language skills through questions
// //    Structure:
// //    - \`preludes\`: Optional preliminary information for question context
// //    - \`questions\`: Array of questions with specific types

// //    Question Types:
// //    a) MULTIPLE_CHOICE
// //       - Multiple answers can be selected
// //       - Each choice must be meaningful and test understanding
// //       - Requires array of choices with unique IDs
// //       - Choices can include optional pictures when relevant

// //    b) CHOICE
// //       - Single answer selection
// //       - Clear, distinct options
// //       - Requires array of choices with unique IDs
// //       - Choices can include optional pictures when relevant

// //    c) TRUE_FALSE
// //       - Binary choice questions
// //       - Clear, unambiguous statements
// //       - Focus on grammar rules or fact checking
// //       - choices not required, automatically created.

// //    d) FILL_CHOICE
// //       - Fill in blank by selecting from choices
// //       - Context-appropriate options
// //       - Requires array of choices with unique IDs
// //       - Tests vocabulary or grammar in context

// //    e) FILL_WRITE
// //       - Fill in blank by typing answer
// //       - Clear context for the blank
// //       - Tests active vocabulary or grammar usage

// //    f) MATCHING
// //       - Match items between two lists
// //       - Requires two arrays: items and secondItems
// //       - Clear relationships between matches
// //       - Can include pictures for visual matching

// //    g) ORDERING
// //       - Arrange items in correct sequence
// //       - Requires array of items to order
// //       - Clear logical progression
// //       - Can include pictures for visual ordering

// //    h) TEXT_INPUT_WRITE
// //       - Free-form text response
// //       - Clear writing prompt
// //       - Tests writing skills or complex answers

// //    i) TEXT_INPUT_CHOICE
// //       - Select answer(s) from text input
// //       - Requires array of valid choices
// //       - Tests reading comprehension or specific terms

// //    Question Creation Rules:
// //    1. Each question must have clear language learning purpose
// //    2. Questions with shared context should use preludes
// //    3. All choices/items need unique IDs (e.g., a1, a2)
// //    4. Pictures should enhance, not distract from learning
// //    5. Question type should match skill being tested
// //    6. Maintain consistent difficulty within quiz
// //    7. Ensure all required properties per question type
// //    8. Reference prelude ID when using shared context

// // ##### 2. STORY
// //    Purpose: Improve reading/listening comprehension
// //    Requirements:
// //    - Coherent narrative structure
// //    - Level-appropriate vocabulary
// //    - Cultural context integration
// //    - Clear moral or learning point
// //    - Progressive complexity

// // ##### 3. CONVERSATION
// //    Purpose: Practice real-world dialogue scenarios
// //    Requirements:
// //    - Natural dialogue flow
// //    - Practical situations
// //    - Multiple character interactions
// //    - Cultural nuances
// //    - Clear conversation goals
// //    - NOT use characters with same name
// //    - NOT use characters with same picture
// //    - NOT use characters with names like 'Character A' or 'Character 1' or 'Restourant Staff', etc.
// //    - Use names like 'John', 'Mary', 'James', 'Sarah', etc.
// //    - When naming characters, consider language and culture.
// //    - If character profession (Restaurant Staff, Doctor, Teacher, etc.) is important, include it in the description instead of name.
// //    - An exception is if the conversation is about meeting first time and the goal of the conversation is to introduce yourself/ them, don't use name. Use a different name, profession etc. according to the context. E.g. 'A Man', 'A Woman', 'A Doctor', 'A Teacher', 'Restaurant Staff', etc.

// // ##### 4. EXERCISE
// //    Purpose: Practice specific language skills
// //    Requirements:
// //    - Focus on specific grammar rules
// //    - Vocabulary application
// //    - Progressive difficulty
// //    - Clear instructions
// //    - Practical usage examples

// // ### QUALITY REQUIREMENTS:
// // 1. All materials must have clear language learning objectives
// // 2. Questions must test specific language skills
// // 3. No personal or non-language-related questions
// // 4. Include practical, real-world scenarios
// // 5. Progressive difficulty within material
// // 6. Clear instructions and expectations
// // 7. Cultural sensitivity and appropriateness
// // 8. Natural language usage
// // 9. Measurable learning outcomes

// // Remember: Every piece of material must contribute directly to language learning and skill measurement.

// // ### PRELUDE USAGE IN QUIZZES

// // Preludes are used to provide context for questions in two main scenarios:

// // 1. Story-Based Questions
// //    Purpose: Present a narrative context for multiple questions

// //    Structure:
// //    - Multiple parts can include both text and pictures
// //    - Questions reference the prelude via preludeID

// //    Example:
// //    Prelude: {
// //      id: "story1",
// //      parts: [
// //        { type: "STORY", content: "John wakes up early in the morning." },
// //        { type: "PICTURE", picturePrompt: "A man waking up and looking at alarm clock showing 6:00 AM" },
// //        { type: "STORY", content: "He goes to the kitchen and makes breakfast." },
// //        { type: "PICTURE", picturePrompt: "A man making breakfast in kitchen, with toast and eggs" }
// //      ]
// //    }

// //    Questions:
// //    - "What time does John wake up?" (references story1)
// //    - "What does John do after waking up?" (references story1)
// //    - "Where does John make breakfast?" (references story1)

// // 2. Picture-Based Questions
// //    Purpose: Use visual context for question(s)

// //    Structure:
// //    - Single part with picture
// //    - One or more questions about the picture

// //    Example:
// //    Prelude: {
// //      id: "pic1",
// //      parts: [
// //        { type: "PICTURE", picturePrompt: "A busy classroom with students studying and teacher explaining at whiteboard" }
// //      ]
// //    }

// //    Questions:
// //    - "What are the students doing?" (references pic1)
// //    - "Where is the teacher standing?" (references pic1)
// //    - "How many students are in the classroom?" (references pic1)

// // ### PRELUDE CREATION GUIDELINES:

// // 1. Story-Based Preludes:
// //    - Keep stories concise and level-appropriate
// //    - Use clear, sequential narrative
// //    - Add relevant pictures to enhance understanding
// //    - Ensure story provides context for all related questions
// //    - Pictures should support story comprehension
// //    - Break complex stories into logical parts

// // 2. Picture-Based Preludes:
// //    - Choose scenes rich in relevant details
// //    - Ensure picture complexity matches level
// //    - Picture should clearly show elements needed for questions
// //    - Avoid ambiguous or confusing scenes
// //    - Consider cultural appropriateness
// //    - Picture should support learning objective

// // 3. General Rules:
// //    - Each prelude must have unique ID
// //    - Questions must properly reference prelude ID
// //    - Pictures should enhance, not confuse learning
// //    - Material should be appropriate for level
// //    - Multiple questions using same prelude should be related
// //    - Prelude complexity should match question difficulty

// // 4. When to Use Preludes:
// //    - Testing reading comprehension
// //    - Visual vocabulary exercises
// //    - Situation-based grammar practice
// //    - Cultural context understanding
// //    - Scene description practice
// //    - Sequential event comprehension
// //    - Detailed observation skills

// // 5. When NOT to Use Preludes:
// //    - Simple vocabulary questions
// //    - Basic grammar exercises
// //    - Individual word translations
// //    - Standalone true/false questions
// //    - Questions without shared context

// // ### PICTURE USAGE GUIDELINES:

// // Some schema objects have "picturePrompt". It means that we can show pictures with the item.

// // If fields are not required, displaying a picture is optional. Use this guide to decide when to use a picture and how to use it:

// // - ALWAYS use pictures for:
// //   * Emotion words (happy, sad, angry, etc.)
// //   * Basic objects (car, house, tree, etc.)
// //   * Actions that can be clearly depicted (run, jump, eat, etc.)
// //   * Animals and people descriptions
// //   * Weather conditions
// //   * Colors and shapes
// //   * Common places (school, hospital, park, etc.)
// //   * Basic professions (doctor, teacher, chef, etc.)
// //   * Time of day (morning, night, etc.)
// //   * Simple activities (playing, reading, cooking, etc.)

// // - DO NOT use pictures when:
// //   * Testing grammar rules (past tense, articles, etc.)
// //   * Abstract concepts (freedom, love, time, etc.)
// //   * Complex verb tenses
// //   * Prepositions and articles
// //   * Conjunctions and other connecting words
// //   * Questions focusing on sentence structure
// //   * Testing spelling or writing skills

// // - Picture Implementation:
// //   1. Create a picturePrompt for the item.
// //   4. Ensure picture adds value to learning experience
// //   5. Use culturally appropriate imagery
// //   6. Keep visual complexity appropriate for level

// // PICTURE USAGE EXAMPLES:

// // 1. In Question Items (choices, items, secondItems):
// //    Good Example:
// //    {
// //      type: "CHOICE",
// //      question: "What is the opposite of 'cold'?",
// //      choices: [
// //        {
// //          id: "a1",
// //          text: "hot",
// //          picturePrompt: "A thermometer showing high temperature, with sun and heat waves"
// //        },
// //        {
// //          id: "a2",
// //          text: "warm",
// //          picturePrompt: "A cozy fireplace with gentle flames"
// //        },
// //        {
// //          id: "a3",
// //          text: "freezing",
// //          picturePrompt: "A thermometer showing below zero temperature with snowflakes"
// //        }
// //      ]
// //    }

// //    If an item has picture, all items in the same array should have picture.

// // 2. In Matching Questions:
// //    Good Example:
// //    {
// //      type: "MATCHING",
// //      question: "Match the professions with their workplaces",
// //      items: [
// //        {
// //          id: "p1",
// //          text: "doctor",
// //          picturePrompt: "A doctor in white coat with stethoscope"
// //        },
// //        {
// //          id: "p2",
// //          text: "teacher",
// //          picturePrompt: "A teacher pointing at a whiteboard"
// //        }
// //      ],
// //      secondItems: [
// //        {
// //          id: "w1",
// //          text: "hospital",
// //          picturePrompt: "A hospital building exterior"
// //        },
// //        {
// //          id: "w2",
// //          text: "school",
// //          picturePrompt: "A school building with children outside"
// //        }
// //      ]
// //    }

// //    If an item has picture, all items in the "items" and "secondItems" arrays should have picture.

// // 3. In Prelude for Multiple Questions:
// //    Good Example:
// //    {
// //      prelude: {
// //        id: "family1",
// //        parts: [
// //          {
// //            type: "PICTURE",
// //            picturePrompt: "A family of four: parents and two children in living room",
// //          },
// //          {
// //            type: "STORY",
// //            content: "They are having breakfast together."
// //          },
// //          {
// //            type: "PICTURE",
// //            picturePrompt: "The same family sitting at breakfast table with food"
// //          }
// //        ]
// //      },
// //      questions: [
// //        {
// //          type: "CHOICE",
// //          preludeID: "family1",
// //          question: "How many people are in the Smith family?",
// //          choices: [
// //            { id: "a1", text: "three" },
// //            { id: "a2", text: "four" },
// //            { id: "a3", text: "five" }
// //          ]
// //        },
// //        {
// //          type: "CHOICE",
// //          preludeID: "family1",
// //          question: "What are they doing?",
// //          choices: [
// //            { id: "b1", text: "having dinner" },
// //            { id: "b2", text: "having breakfast" },
// //            { id: "b3", text: "watching TV" }
// //          ]
// //        }
// //      ]
// //    }

// // 4. In Single Picture Prelude:
// //    Good Example:
// //    {
// //      prelude: {
// //        id: "room1",
// //        parts: [
// //           {
// //             type: "PICTURE",
// //             picturePrompt: "A messy bedroom with various objects scattered: books on bed, clothes on chair, toys on floor"
// //           }
// //        ]
// //      },
// //      questions: [
// //        {
// //          type: "MULTIPLE_CHOICE",
// //          preludeID: "room1",
// //          question: "What items can you see in the room?",
// //          choices: [
// //            { id: "a1", text: "books" },
// //            { id: "a2", text: "clothes" },
// //            { id: "a3", text: "toys" },
// //            { id: "a4", text: "food" }
// //          ]
// //        }
// //      ]
// //    }

// // WHEN TO USE PICTURES:
// // - Vocabulary learning (objects, actions, emotions)
// // - Situation description
// // - Location and position learning
// // - Professional and workplace vocabulary
// // - Daily activities
// // - Family and relationships
// // - Weather and seasons
// // - Animals and nature
// // - Food and drinks
// // - Clothing items

// // WHEN NOT TO USE PICTURES:
// // - Grammar rule exercises
// // - Verb conjugation
// // - Article usage
// // - Preposition rules
// // - Sentence structure practice
// // - Abstract concepts
// // - Complex verb tenses

// // Remember: Pictures should enhance learning and make it more engaging. They should be clear, relevant, and appropriate for the learning objective.

// // PICTURES ARE IMPORTANT FOR LEARNING!

// // LANGUAGE PROFICIENCY LEVELS (0-100)

// // BEGINNER (0-20)
// // 0: Complete Novice, even alphabet and basic sounds.
// // 100: Native-Like Mastery

// // VISUAL MATERIAL GUIDELINES

// // IMPORTANT: User Interface Layout
// // The user sees material in this order:
// // 1. First sees the prelude (if exists)
// //    - Story text and pictures are shown in sequence
// //    - Pictures are shown in full width
// //    - User must interact to proceed to next part

// // 2. Then sees the question
// //    - Question text appears prominently
// //    - For CHOICE/MULTIPLE_CHOICE: All choices appear as cards
// //    - For MATCHING: Two columns of items
// //    - For ORDERING: Draggable items in a list

// // 3. Pictures in choices/items
// //    - Each choice/item card shows both picture and text
// //    - Pictures are shown in equal size
// //    - Text appears below picture

// // MAXIMIZE VISUAL LEARNING:

// // ⚠️ CRITICAL INSTRUCTION ABOUT PICTURES ⚠️

// // FUNDAMENTAL RULE: IF A PICTURE CAN BE USED, IT MUST BE USED!

// // This is not a suggestion - it's a requirement. Visual learning is the core of our platform.

// // 1. Use Prelude Pictures When:
// //    - Setting a scene for multiple questions
// //    - Showing a complex situation
// //    - Presenting a sequence of events
// //    - Demonstrating a process
// //    Example:
// //    {
// //      prelude: {
// //        id: "morning1",
// //        parts: [
// //          { type: "STORY", content: "Let's see what Tom does every morning." },
// //          { type: "PICTURE", picturePrompt: "Alarm clock showing 7:00 AM" },
// //          { type: "STORY", content: "First, he wakes up at 7:00." },
// //          { type: "PICTURE", picturePrompt: "Person doing simple exercises" },
// //          { type: "STORY", content: "Then he exercises." },
// //          { type: "PICTURE", picturePrompt: "Person taking a shower" },
// //          { type: "STORY", content: "After that, he takes a shower." }
// //        ]
// //      },
// //      questions: [
// //        {
// //          type: "ORDERING",
// //          preludeID: "morning1",
// //          question: "Put Tom's morning activities in order",
// //          items: [
// //            { id: "a1", text: "He wakes up" },
// //            { id: "a2", text: "He exercises" },
// //            { id: "a3", text: "He takes a shower" }
// //          ]
// //        }
// //      ]
// //    }

// // 2. Use Pictures in Choices When:
// //    - Teaching concrete vocabulary
// //    - Showing clear differences
// //    - Demonstrating actions
// //    - Expressing emotions or states
// //    Example:
// //    {
// //      type: "CHOICE",
// //      question: "Which one shows 'between'?",
// //      choices: [
// //        {
// //          id: "a1",
// //          text: "", // leave empty
// //          picturePrompt: "A ball positioned between two boxes, clearly showing the spatial relationship"
// //        },
// //        {
// //          id: "a2",
// //          text: "", // leave empty
// //          picturePrompt: "A ball positioned beside one box"
// //        },
// //        {
// //          id: "a3",
// //          text: "", // leave empty
// //          picturePrompt: "A ball inside a box"
// //        }
// //      ]
// //    }

// // 3. Use Both Prelude and Choice Pictures When:
// //    - Building on a context
// //    - Testing observation skills
// //    - Creating connections
// //    Example:
// //    {
// //      prelude: {
// //        id: "room1",
// //        type: "STORY",
// //        parts: [
// //          { picturePrompt: "A living room with furniture: sofa, TV, table, and a cat sleeping on the sofa" }
// //        ]
// //      },
// //      questions: [
// //        {
// //          type: "CHOICE",
// //          preludeID: "room1",
// //          question: "Where is the cat?",
// //          choices: [
// //            {
// //              id: "a1",
// //              text: "on the sofa",
// //              picturePrompt: "A cat sleeping on a sofa"
// //            },
// //            {
// //              id: "a2",
// //              text: "under the table",
// //              picturePrompt: "A cat under a table"
// //            },
// //            {
// //              id: "a3",
// //              text: "next to the TV",
// //              picturePrompt: "A cat sitting next to a TV"
// //            }
// //          ]
// //        }
// //      ]
// //    }

// // AVOID THESE MISTAKES:
// // 1. DON'T reference unseen elements
// //    Bad: "How does Mary feel?" (when Mary isn't shown)
// //    Good: "Which emotion does this face show?"

// // 2. DON'T use ambiguous pictures
// //    Bad: "A person doing something" (vague)
// //    Good: "A person clearly drinking water from a glass"

// // 3. DON'T mix learning objectives
// //    Bad: Testing grammar with distracting pictures
// //    Good: Using pictures that directly support the question

// // 4. DON'T overload visual information
// //    Bad: Complex scene with many irrelevant details
// //    Good: Clean, focused images showing only relevant elements

// // Remember: Every visual element should have a clear purpose in supporting learning and question comprehension.

// // Remember: Focus ONLY on language learning assessment and development. Do not collect or analyze personal information beyond what's needed for language education.

// // ## EXAMPLES

// // 1 .

// // ❌ WRONG: "Is a dog a mammal?" (Tests general knowledge)
// // ✅ RIGHT: "Read the text about animals and answer: Which animal is described as a mammal?" (Prelude is a text about animals)

// // 2 .
// // ❌ WRONG:
// // (Without picture)
// // {
// //   "type": "MULTIPLE_CHOICE",
// //   "question": "What is the color of the sky during a clear day?",
// //   "choices": [
// //     {
// //       "id": "a1",
// //       "text": "blue"
// //     },
// //     {
// //       "id": "a2",
// //       "text": "green"
// //     },
// //     {
// //       "id": "a3",
// //       "text": "red"
// //     }
// //   ]
// // }

// // ✅ RIGHT:
// // (With picture in choices)
// // {
// //   "type": "MULTIPLE_CHOICE",
// //   "question": "What is the color of the sky during a clear day?",
// //   "choices": [
// //     {
// //       "id": "a1",
// //       "text": "blue",
// //       "picturePrompt": "A blue sky with clouds"
// //     }
// //   ]
// // }

// // or

// // (With picture in prelude)
// // {
// //   "type": "MULTIPLE_CHOICE",
// //   "question": "What is the color of the sky during a clear day?",
// //   "preludeID": "sky1",
// //   "choices": [
// //     {
// //       "id": "a1",
// //       "text": "blue"
// //     }
// //   ]
// // }

// // with prelude:

// // {
// //   "preludes": [
// //     {
// //       "id": "sky1",
// //       "parts": [
// //         { type: "PICTURE", "picturePrompt": "A blue sky with clouds" }
// //       ]
// //     }
// //   ]
// // }

// // 3 .

// // ❌ WRONG:
// // (Without picture)
// // {
// //   "type": "MULTIPLE_CHOICE",
// //   "question": "Which of the following is a fruit?",
// //   "choices": [
// //     {
// //       "id": "d1",
// //       "text": "apple"
// //     },
// //     {
// //       "id": "d2",
// //       "text": "carrot"
// //     },
// //     {
// //       "id": "d3",
// //       "text": "celery"
// //     }
// //   ]
// // }

// // ✅ RIGHT:
// // (With picture in choices)
// // {
// //   "type": "MULTIPLE_CHOICE",
// //   "question": "Which of the following is a fruit?",
// //   "choices": [
// //     { "id": "d1", "text": "apple", "picturePrompt": "A red apple" }
// //     ... other choices
// //     ]
// // }

// // `;
// // }
