import { AiFeedback } from "../../../models/_index";
import { undefinedOrValue } from "../../../utils/validators";
import { ChatGeneration } from "../../ai";
import { FeedbackContext } from "./ctx";

export class FeedbackHelper {
  static gettingFeedback: {
    [materialId: string]: FeedbackContext;
  } = {};

  static async handleAnswer(ctx: FeedbackContext) {
    const materialId = ctx.flow.answeredMaterial!._id.toHexString();

    if (this.gettingFeedback[materialId]) {
      await this.gettingFeedback[materialId].waitUntil("completed");
      return;
    }

    this.gettingFeedback[materialId] = ctx;

    try {
      ctx.startGeneration();
      const prompt = await ctx.getFeedbackPrompt();

      const aiRes = await new ChatGeneration(
        "feedback",
        prompt,
        ctx
      ).generate();

      const feedbacks = undefinedOrValue(aiRes.feedbacks, null);

      if (feedbacks) {
        await AiFeedback.insertMany(
          feedbacks.map((e) => {
            return {
              feedback: e,
              user_ID: ctx.flow.user._id,
              seen: false,
              material_ID: ctx.flow.answeredMaterial!._id,
            };
          })
        );
      }

      await ctx.flow.updateAnsweredMaterial({
        feedbackStatus: "COMPLETED",
      });

      await ctx.complete();
    } catch (e) {
      ctx.addError(e as Error);
      throw e;
    } finally {
      delete this.gettingFeedback[materialId];
    }
  }
}
