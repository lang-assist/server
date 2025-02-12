// import { AIImageGenerator } from "./base";

// import fs from "fs";
// import path from "path";

// const images = fs.readdirSync(path.join(process.env.VOLUME!, "fake_images"));

// export class FakeImageGenerator extends AIImageGenerator {
//   readonly name = "fake_img";

//   async _init() {}

//   async _generateItemPicture(prompt: string): Promise<{
//     data: Buffer;
//     contentType: string;
//   }> {
//     const image = images[Math.floor(Math.random() * images.length)];
//     return {
//       data: fs.readFileSync(
//         path.join(process.env.VOLUME!, "fake_images", image)
//       ),
//       contentType: "image/jpeg",
//     };
//   }
// }
