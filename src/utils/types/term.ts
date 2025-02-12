export interface UnitProps {
  key: string;
  value?: string;
  dict?: boolean;
  doc?: {
    title?: string;
    search?: string;
  };
}

export interface LinguisticUnit {
  text: string;
  props: UnitProps[];
  subUnits?: LinguisticUnit[];
}

export type LinguisticUnitSet = LinguisticUnit[];

export const unitPropsRef = {
  $ref: "#/definitions/UnitProps",
};

const unitPropsSchema = {
  type: "object",
  properties: {
    key: { type: "string", description: "Key of the property." },
    value: { type: "string", description: "Value of the property." },
    dict: {
      type: "boolean",
      description: "If the property is a dictionary item ref.",
    },
    doc: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title of the documentation item.",
        },
        search: {
          type: "string",
          description: "Search of the documentation item.",
        },
      },
      description: "If the property is a documentation item ref.",
    },
  },
  additionalProperties: false,
};

const linguisticUnitSchema = {
  type: "object",
  properties: {
    text: { type: "string", description: "Value in string format." },
    props: {
      type: "array",
      items: unitPropsRef,
      description: "Properties of the unit.",
    },
    subUnits: {
      type: "array",
      items: { $ref: "#/definitions/LinguisticUnit" },
      description:
        "If the unit is a compound term, idiom, etc. it will have sub units.",
    },
  },
  required: ["text"],
  additionalProperties: false,
};

export const linguisticUnitRef = {
  $ref: "#/definitions/LinguisticUnit",
};

export const linguisticUnitDefinitions = {
  UnitProps: unitPropsSchema,
  LinguisticUnit: linguisticUnitSchema,
};

export const linguisticUnitSetSchema = {
  type: "object",
  name: "LinguisticUnitSet",
  definitions: {
    ...linguisticUnitDefinitions,
  },
  properties: {
    result: {
      type: "array",
      items: linguisticUnitRef,
      description: "The result of the parsing.",
    },
  },
  required: ["result"],
  additionalProperties: false,
};
