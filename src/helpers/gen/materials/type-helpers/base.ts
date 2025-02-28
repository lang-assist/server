import { ObjectId, WithId } from "mongodb";
import { BrocaTypes } from "../../../../types";
import {
  AnswerContext,
  MaterialBaseContext,
  MaterialGenerationContext,
} from "../ctx";
import {
  SpeechGeneration,
  TranscriptionGeneration,
} from "../../../ai/voice/base";
import { ImageGeneration } from "../../../ai/img/base";
import { ConversationTurn, IUserAnswer } from "../../../../models/_index";
import { msg } from "../../../../utils/prompter";
import { ConversationManager } from "../conversation";
import { StorageService } from "../../../storage";

export abstract class BaseMaterialTypeHelper {
  constructor(readonly type: BrocaTypes.Material.MaterialType) {}

  public static addHelpers(helpers: {
    [key in BrocaTypes.Material.MaterialType]: BaseMaterialTypeHelper;
  }) {
    for (const [key, value] of Object.entries(helpers)) {
      BaseMaterialTypeHelper.helpers[key as BrocaTypes.Material.MaterialType] =
        value;
    }
  }

  // @ts-ignore
  private static helpers: {
    [key in BrocaTypes.Material.MaterialType]: BaseMaterialTypeHelper;
  } = {};

  abstract _prepareAnswer(ctx: AnswerContext): Promise<any>;

  static async prepareAnswer(ctx: AnswerContext): Promise<any> {
    const helper = BaseMaterialTypeHelper.helpers[ctx.materialType];

    if (!helper) {
      throw new Error(`No helper found for material type ${ctx.materialType}`);
    }

    ctx.startGeneration();

    const res = await helper._prepareAnswer(ctx);

    await ctx.setAnswer(res);

    await ctx.flow.updateAnsweredMaterial({
      compStatus: "COMPLETED",
    });

    await ctx.complete();

    return res;
  }

  static prepare(
    ctx: MaterialGenerationContext,
    details: BrocaTypes.Material.MaterialDetails,
    metadata: BrocaTypes.Material.MaterialMetadata
  ): {
    metadata: BrocaTypes.Material.MaterialMetadata;
    details: BrocaTypes.Material.MaterialDetails;
    promises: Promise<void>[];
  } {
    const promises: Promise<void>[] = [];

    const helper = BaseMaterialTypeHelper.helpers[ctx.requiredMaterial.type];

    details.type = ctx.requiredMaterial.type;

    if (!helper) {
      throw new Error(
        `No helper found for material type ${ctx.requiredMaterial.type}`
      );
    }
    if (!details) {
      throw new Error(
        `No details found for material type ${ctx.requiredMaterial.type}`
      );
    }

    const prepRes = helper.prepareDetails(ctx, details);

    details = prepRes.details;

    promises.push(...prepRes.promises);

    return {
      metadata,
      promises,
      details,
    };
  }

  static describeDetails(details: BrocaTypes.Material.MaterialDetails) {
    const helper = BaseMaterialTypeHelper.helpers[details.type];

    if (!helper) {
      throw new Error(`No helper found for material type ${details.type}`);
    }

    return helper._describeDetails(details);
  }

  static describeAnswer(
    type: BrocaTypes.Material.MaterialType,
    answer: WithId<IUserAnswer>
  ) {
    const helper = BaseMaterialTypeHelper.helpers[type];

    if (!helper) {
      throw new Error(`No helper found for material type ${type}`);
    }

    return helper._describeAnswer(answer.answers);
  }

  abstract prepareDetails(
    ctx: MaterialGenerationContext,
    details: BrocaTypes.Material.MaterialDetails
  ): {
    details: BrocaTypes.Material.MaterialDetails;
    promises: Promise<any>[];
  };

  abstract _describeDetails(
    details: BrocaTypes.Material.MaterialDetails
  ): string;

  abstract _describeAnswer(answer: any): string;

  speechAudio(
    ctx: MaterialBaseContext,
    ssml: string,
    meta: {
      reason: string;
      [key: string]: any;
    }
  ) {
    const audioId = new ObjectId();

    const gen = new SpeechGeneration(ssml, audioId, ctx.language, ctx, {
      ...meta,
      produced: audioId,
    });

    const audPromise = gen.generate();

    return {
      audioId: audioId.toHexString(),
      promise: audPromise,
    };
  }

  generateItemPicture(
    ctx: MaterialBaseContext,
    prompt: string,
    meta: {
      reason: string;
      [key: string]: any;
    }
  ) {
    const id = new ObjectId();
    const gen = new ImageGeneration(prompt, id, ctx, {
      ...meta,
      produced: id,
    });

    const imgPromise = gen.generate();

    return {
      id: id.toHexString(),
      promise: imgPromise,
    };
  }

  modifyQuestion(
    ctx: MaterialBaseContext,
    question: BrocaTypes.Material.Quiz.QuizQuestion
  ): {
    question: BrocaTypes.Material.Quiz.QuizQuestion;
    promises: Promise<any>[];
  } {
    const promises: Promise<any>[] = [];

    question.choices = question.choices?.map((item) => {
      const r = this.modifyQuestionItem(ctx, item);
      promises.push(...r.promises);
      return r.item;
    });
    question.secondaryChoices = question.secondaryChoices?.map((item) => {
      const r = this.modifyQuestionItem(ctx, item);
      promises.push(...r.promises);
      return r.item;
    });

    return {
      question,
      promises,
    };
  }

  modifyQuestionItem(
    ctx: MaterialBaseContext,
    item: BrocaTypes.Material.Quiz.QuestionItem
  ): {
    item: BrocaTypes.Material.Quiz.QuestionItem;
    promises: Promise<any>[];
  } {
    const promises: Promise<any>[] = [];

    if (item.picturePrompt) {
      const img = this.generateItemPicture(ctx, item.picturePrompt, {
        reason: "quizItemPicture",
      });
      item.pictureId = img.id;
      promises.push(img.promise);
    }

    return {
      item,
      promises,
    };
  }

  describeQuestion(q: BrocaTypes.Material.Quiz.QuizQuestion) {
    const m = msg();
    m.addKv(`Question "${q.id}"`, (s) => {
      s.addKv("Type", q.type);
      if (q.preludeID) {
        s.addKv("Prelude", q.preludeID);
      }
      s.addKv("Question", q.question);

      if (q.choices) {
        s.addKv("Choices", (sub) => {
          for (const c of q.choices!) {
            if (c.picturePrompt) {
              sub.addKv(c.id, (sub2) => {
                sub2.addKv("Text", c.text);
                sub2.addKv("Picture Prompt", c.picturePrompt!);
              });
            } else {
              sub.addKv(c.id, c.text);
            }
          }
        });
      }

      if (q.secondaryChoices) {
        s.addKv("Secondary Choices", (sub) => {
          for (const c of q.secondaryChoices!) {
            if (c.picturePrompt) {
              sub.addKv(c.id, (sub2) => {
                sub2.addKv("Text", c.text);
                sub2.addKv("Picture Prompt", c.picturePrompt!);
              });
            } else {
              sub.addKv(c.id, c.text);
            }
          }
        });
      }
    });

    return m.build();
  }

  describeQuestions(question: BrocaTypes.Material.Quiz.QuizQuestion[]) {
    const m = msg();

    for (const q of question) {
      m.addKv(`Question "${q.id}"`, this.describeQuestion(q));
    }

    return m.build();
  }

  describeQuestionAnswer(answer: BrocaTypes.Material.Quiz.QuizAnswer) {


    const m = msg();

    for (const [key, a] of Object.entries(answer)) {
      m.addKv(key, (s) => {
        if (typeof a.answer === "string") {
          s.addKv("Answer (Text)", a.answer);
        } else if (Array.isArray(a.answer)) {
          if (a.answer.some((a) => Array.isArray(a))) {
            s.addKv("Answer (Matches)", (sub) => {
              for (const subArray of a.answer as string[][]) {
                sub.addKv(subArray[0], subArray[1]);
              }
            });
          } else {
            s.addKv("Answer (Selected Choices)", a.answer.join(", "));
          }
        } else if (typeof a.answer === "object") {
          s.addKv("Answer (Blank: Text)", (sub) => {
            for (const [key, value] of Object.entries(a.answer)) {
              sub.addKv(key, value);
            }
          });
        } else if (typeof a.answer === "boolean") {
          s.addKv("Answer (Boolean)", a.answer);
        }

        s.addKv("Took in seconds", a.answeredIn);

        if (a.behaviors && a.behaviors.length > 0) {
          s.addKv("Behaviors", a.behaviors.join(", "));
        }
      });
    }

    return m.build();
  }

  async prepareQuestionAnswer(
    ctx: AnswerContext
  ): Promise<BrocaTypes.Material.Quiz.QuizAnswer> {
    const rawAnswer = ctx.rawAnswer as {
      [key: string]: BrocaTypes.Material.Quiz.QuestionAnswer;
    };

    const type = ctx.material.details.type;

    let questions: BrocaTypes.Material.Quiz.QuizQuestion[];

    if (type === "QUIZ") {
      questions = (ctx.material.details as BrocaTypes.Material.Quiz.QuizDetails)
        .questions;
    } else if (type === "STORY") {
      questions = (
        ctx.material.details as BrocaTypes.Material.Story.StoryDetails
      ).parts
        .filter((p) => p.type === "QUESTION")
        .map((p) => p.question as BrocaTypes.Material.Quiz.QuizQuestion);
    } else {
      throw new Error("Invalid material type");
    }

    const answers: {
      [key: string]: BrocaTypes.Material.Quiz.QuestionAnswer;
    } = {};

    const promises: Promise<{
      id: string;
      updates: {
        [key: string]: any;
      };
    }>[] = [];

    for (const question of questions) {
      const qAnswer = rawAnswer[question.id];

      switch (question.type) {
        case "CHOICE":
          if (!qAnswer.answer || typeof qAnswer.answer !== "string") {
            throw new Error("Answer is required for choice type question");
          }
          break;
        case "MULTIPLE_CHOICE":
          if (!qAnswer.answer || !Array.isArray(qAnswer.answer)) {
            throw new Error(
              "Answer is required for multiple choice type question"
            );
          }
          break;
        case "FILL_CHOICE":
          if (!qAnswer.answer || typeof qAnswer.answer !== "string") {
            throw new Error("Answer is required for fill choice type question");
          }
          break;
        case "FILL_WRITE":
          if (!qAnswer.answer || typeof qAnswer.answer !== "object") {
            throw new Error("Answer is required for fill write type question");
          }
          break;
        case "MATCHING":
          // expect string[][]
          if (
            !qAnswer.answer ||
            !Array.isArray(qAnswer.answer) ||
            qAnswer.answer.some((a) => !Array.isArray(a))
          ) {
            throw new Error("Answer is required for matching type question");
          }
          break;
        case "ORDERING":
          // expect string[]
          if (!qAnswer.answer || !Array.isArray(qAnswer.answer)) {
            throw new Error("Answer is required for ordering type question");
          }
          break;
        case "TEXT_INPUT_WRITE":
          if (!qAnswer.answer || typeof qAnswer.answer !== "string") {
            throw new Error(
              "Answer is required for text input write type question"
            );
          }
          break;
        case "RECORD":

          if (
            !qAnswer.answer ||
            typeof qAnswer.answer !== "string" ||
            !ObjectId.isValid(qAnswer.answer)
          ) {
            throw new Error("Audio ID is required for record type question");
          }

          const prom = new Promise<{
            id: string;
            updates: {
              [key: string]: any;
            };
          }>(async (resolve, reject) => {
            const buffer = await StorageService.getAudio(
              new ObjectId(qAnswer.answer as string)
            );

            const transcription = new TranscriptionGeneration(buffer, ctx, {
              reason: "answerRecord",
            });

            const transcriptionResult = await transcription.generate();

            if (transcriptionResult.analyze) {
              const analysis = transcriptionResult.analyze;
              const m = msg();

              m.addKv("Transcription", transcriptionResult.transcription);
              m.addKv("Analysis", (s) => {
                Object.entries(analysis).map(([key, value]) => {
                  s.addKv(key, `${value}`);
                });
              });

              resolve({
                id: question.id,
                updates: {
                  transcription: m.build(),
                },
              });
            } else {
              resolve({
                id: question.id,
                updates: {
                  transcription: transcriptionResult.transcription,
                },
              });
            }
          });

          promises.push(prom);

          break;
        case "TRUE_FALSE":
          if (typeof qAnswer.answer !== "boolean") {
            throw new Error("Answer is required for true false type question");
          }
          break;
      }
    }

    const toUpdates = await Promise.all(promises);

    for (const update of toUpdates) {
      rawAnswer[update.id] = {
        ...rawAnswer[update.id],
        ...update.updates,
      };
    }

    for (const question of questions) {
      const qAnswer = rawAnswer[question.id];
      answers[question.id] = qAnswer;
    }


    return answers;
  }
}
