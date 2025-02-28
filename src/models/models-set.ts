import { DbHelper } from "../helpers/db";
import { COLLECTIONS } from "../utils/constants";
import { AIModels } from "../utils/constants";

export interface IModel {
  name: string;
  description: string;
  chatModel: keyof typeof AIModels.chat;
  ttsModel: keyof typeof AIModels.tts;
  sttModel: keyof typeof AIModels.stt;
  imgModel: keyof typeof AIModels.img;
}

export const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.MODELS_SETS,
  createdAtField: false,
  updatedAtField: false,
  cacheById: true,
});

// const examples : IModel[] = [
//     {
//         name: "Azure Fast",
//         chatModel: "azure_gpt_4o",
//         imgModel: "fal_flux_schnell",
//         sttModel: "azure_stt",
//         ttsModel: "azure_tts",
//         description: "Azure Fast",
//     },
//     {
//         name: "Azure Intelligent",
//         chatModel: "azure_o1",
//         imgModel: "fal_flux_schnell",
//         sttModel: "azure_stt",
//         ttsModel: "azure_tts",
//         description: "Azure Intelligent",
//     },
//     {
//         name: "Claude",
//         chatModel: "claude_sonnet37",
//         imgModel: "fal_flux_schnell",
//         sttModel: "azure_stt",
//         ttsModel: "azure_tts",
//         description: "Claude",
//     },
//     {
//         name: "DeepSeek",
//         chatModel: "deepseek_chat",
//         imgModel: "fal_flux_schnell",
//         sttModel: "azure_stt",
//         ttsModel: "azure_tts",
//         description: "DeepSeek",
//     },
// ]
