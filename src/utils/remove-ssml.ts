import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: true,
  preserveOrder: true,
  trimValues: false,
});

export function removeSSML(ssml: string) {
  const parsed = parser.parse(ssml);

  const texts = _readTexts(parsed);

  return texts.join("");
}

function _readTexts(node: any): string[] {
  if (Array.isArray(node)) {
    const texts = [];
    for (const child of node) {
      texts.push(..._readTexts(child));
    }
    return texts;
  } else if (typeof node === "object") {
    if (node["#text"]) {
      return [node["#text"]];
    } else {
      const texts = [];
      for (const key in node) {
        texts.push(..._readTexts(node[key]));
      }
      return texts;
    }
  } else {
    return [node];
  }
}
