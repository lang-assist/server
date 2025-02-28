// import { ObjectId, WithId } from "mongodb";
// import {
//   AiFeedback,
//   IAiFeedback,
//   IMaterial,
//   IUser,
//   Material,
// } from "../models/_index";
// import { undefinedOrValue } from "../utils/validators";
// import { AIModel } from "./ai";
// import { GenerationFlow } from "../types/ctx";

// // function modifyMaterials(
// //   language: string,

// //   material: {
// //     details: MaterialDetails;
// //     metadata: MaterialMetadata;
// //   }
// // ): {
// //   metadata: MaterialMetadata;
// //   details: MaterialDetails;
// // } {
// //   material.metadata.avatar = randomColor();

// //   switch (material.details.type) {
// //     case "QUIZ":
// //       break;

// //     case "STORY":
// //       const parts = (material.details as StoryDetails).parts;

// //       for (const part of parts) {
// //         if (part.type === "PICTURE" && part.picturePrompt) {
// //           const id = new ObjectId();
// //           PictureHelper.generateItemPicture({
// //             itemId: id,
// //             prompt: part.picturePrompt,
// //           });

// //           part.pictureId = id.toHexString();
// //         } else if (part.type === "AUDIO" && part.ssml) {
// //           part.audioId = speechAudio(part.ssml!, language);
// //         } else if (part.type === "QUESTION" && part.question) {
// //           part.question = modifyQuestion(part.question);
// //         }
// //       }

// //       break;
// //   }

// //   return {
// //     metadata: material.metadata,
// //     details: material.details,
// //   };
// // }

// type GenerationPromise = Promise<{
//   material: WithId<IMaterial> | null;
//   feedbacks: WithId<IAiFeedback>[];
// }>;

// export class MaterialHelper {
//   static generatingMaterials: {
//     [path: string]: {
//       [materialId: string]: {
//         flow: GenerationFlow;
//         promise: GenerationPromise;
//       };
//     };
//   } = {};

//   static analyzingMaterials: {
//     [path: string]: {
//       [materialId: string]: {
//         flow: GenerationFlow;
//         promise: GenerationPromise;
//       };
//     };
//   } = {};

//   static async handleFeedbacks(
//     ctx: MaterialGenerationContext,
//     feedback: AIFeedbackInterface
//   ) {
//     const inserted = await AiFeedback.insertOne({
//       feedback,
//       seen: false,
//       user_ID: ctx.user._id,
//       material_ID: ctx.material!._id,
//     });

//     if (!inserted) {
//       throw new Error("Feedback not inserted");
//     }

//     return inserted;
//   }

//   static async prepareMaterial(
//     ctx: MaterialGenerationContext,
//     result: AIGenerationResponse
//   ): Promise<{
//     material: WithId<IMaterial> | null;
//     feedbacks: WithId<IAiFeedback>[];
//   }> {
//     if (!result) {
//       ctx.addError(new Error("Material not created"));
//       return {
//         material: null,

//         feedbacks: [],
//       };
//     }

//     const newMaterials = undefinedOrValue(result.newMaterials, undefined);

//     if (ctx.generatingMaterial && !newMaterials) {
//       ctx.addError(new Error("Required materials not created"));
//       return {
//         material: null,
//         feedbacks: [],
//       };
//     }

//     let matPromise: Promise<void> | null = null;

//     if (ctx.generatingMaterial) {
//       if (!ctx.generatingMaterial.material) {
//         ctx.addError(new Error("Generation not started correctly"));
//         return {
//           material: null,
//           feedbacks: [],
//         };
//       }

//       const mat = ctx.generatingMaterial.material;

//       if (!mat) {
//         ctx.addError(new Error("Required material not created"));
//         return {
//           material: null,
//           feedbacks: [],
//         };
//       }

//       matPromise = BaseMaterialTypeHelper.prepare(ctx);
//     }

//     const feedbackPromises: Promise<WithId<IAiFeedback> | null>[] = [];

//     if (ctx.userAnswer && result.feedbacks && ctx.material) {
//       const aiFeedbackRes = result.feedbacks;

//       for (const feedback of aiFeedbackRes) {
//         feedbackPromises.push(this.handleFeedbacks(ctx, feedback));
//       }
//     }

//     if (matPromise) {
//       await matPromise;
//     }

//     const feedbacks = (await Promise.all(feedbackPromises)).filter(
//       (f) => f !== null
//     ) as WithId<IAiFeedback>[];

//     return {
//       material: ctx.generatingMaterial?.material || null,
//       feedbacks: feedbacks.filter((f) => f !== null) as WithId<IAiFeedback>[],
//     };
//   }

//   static async addGen(ctx: MaterialGenerationContext): Promise<{
//     material: WithId<IMaterial> | null;
//     feedbacks: WithId<IAiFeedback>[];
//   }> {
//     const pathId = ctx.path._id.toHexString();

//     const genMaterialId = ctx.generatingMaterial?.material._id.toHexString();
//     const analyzingMaterialId = ctx.material?._id.toHexString();

//     if (genMaterialId && !this.generatingMaterials[pathId]) {
//       this.generatingMaterials[pathId] = {};
//     }

//     if (analyzingMaterialId && !this.analyzingMaterials[pathId]) {
//       this.analyzingMaterials[pathId] = {};
//     }

//     const promise = new Promise<{
//       material: WithId<IMaterial> | null;
//       feedbacks: WithId<IAiFeedback>[];
//     }>(async (resolve, reject) => {
//       const res = await AIModel.generate(ctx);

//       const prepRes = await this.prepareMaterial(ctx, res);

//       resolve(prepRes);
//     });

//     if (genMaterialId) {
//       this.generatingMaterials[pathId][genMaterialId] = {
//         ctx,
//         promise,
//       };
//     }

//     if (analyzingMaterialId) {
//       this.analyzingMaterials[pathId][analyzingMaterialId] = {
//         ctx,
//         promise,
//       };
//     }

//     promise.finally(() => {
//       if (genMaterialId) {
//         delete this.generatingMaterials[pathId][genMaterialId];
//       }

//       if (analyzingMaterialId) {
//         delete this.analyzingMaterials[pathId][analyzingMaterialId];
//       }

//       if (Object.keys(this.generatingMaterials[pathId]).length === 0) {
//         delete this.generatingMaterials[pathId];
//       }

//       if (Object.keys(this.analyzingMaterials[pathId]).length === 0) {
//         delete this.analyzingMaterials[pathId];
//       }
//     });

//     return promise;
//   }

//   static async testGenMaterial(args: {
//     journeyId: ObjectId;
//     pathId: ObjectId;
//     user: WithId<IUser>;
//     requiredMaterials: {
//       material?: WithId<IMaterial>;
//       type: MaterialType;
//       optional?: boolean;
//       description?: string;
//     };
//   }) {
//     if (!args.requiredMaterials.material) {
//       args.requiredMaterials.material = await this.createPreparingMaterial({
//         userId: args.user._id,
//         journeyId: args.journeyId,
//         pathId: args.pathId,
//       });
//     }

//     const ctx = await MaterialGenerationContext.create({
//       user: args.user,
//       journeyId: args.journeyId,
//       pathId: args.pathId,
//     });

//     const result = await this.addGen(ctx);

//     return result.material;
//   }

//   static async createPreparingMaterial(args: {
//     userId: ObjectId;
//     journeyId: ObjectId;
//     pathId: ObjectId;
//     id?: ObjectId;
//   }) {
//     const material = await Material.insertOne(
//       {
//         genStatus: "CREATING",
//         compStatus: "NOT_STARTED",
//         convStatus: "NOT_STARTED",
//         user_ID: args.userId,
//         journey_ID: args.journeyId,
//         path_ID: args.pathId,
//       },
//       args.id
//     );

//     if (!material) {
//       throw new Error("Material not inserted");
//     }

//     return material;
//   }

//   static async regenerateMaterial(materialId: ObjectId, user: WithId<IUser>) {
//     const material = await Material.findById(materialId);
//     if (!material) {
//       throw new Error("Material not found");
//     }

//     await Material.findByIdAndDelete(materialId);

//     const mat = await this.createPreparingMaterial({
//       userId: material.user_ID,
//       journeyId: material.journey_ID,
//       pathId: material.path_ID,
//     });

//     const ctx = await MaterialGenerationContext.create({
//       user: user,
//       journeyId: material.journey_ID,
//       pathId: material.path_ID,
//       generatingMaterial: {
//         type: material.details.type,
//         material: mat,
//         optional: false,
//         description: "",
//       },
//     });

//     const result = await this.addGen(ctx);

//     return result.material;
//   }

//   // static async prepareMaterial(input: {
//   //   materialId: ObjectId;
//   //   language: string;
//   // }): Promise<WithId<IMaterial>> {
//   //   const material = await Material.findById(input.materialId);
//   //   if (!material) {
//   //     throw new Error("Material not found");
//   //   }

//   //   modifyMaterials(input.language, material);

//   //   const modified = await Material.findByIdAndUpdate(material._id, {
//   //     $set: {
//   //       details: material.details,
//   //       metadata: material.metadata,
//   //     },
//   //   });

//   //   if (!modified) {
//   //     throw new Error("Material not updated");
//   //   }

//   //   return modified;
//   // }

//   static generatingCount(pathId: string) {
//     if (!this.generatingMaterials[pathId]) {
//       return 0;
//     }

//     let count = 0;

//     for (const _ in this.generatingMaterials[pathId]) {
//       count += 1;
//     }

//     return count;
//   }

//   static generatingPathMaterials(pathId: string): string[] {
//     if (!this.generatingMaterials[pathId]) {
//       return [];
//     }

//     return Object.keys(this.generatingMaterials[pathId]);
//   }
// }
