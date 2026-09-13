const normalized = { type: 'number', minimum: 0, maximum: 1 }
const stringArray = { type: 'array', items: { type: 'string' } }

export const referenceAnalysisSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['analyses'],
  properties: {
    analyses: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id', 'hierarchy', 'imageTextRatio', 'visualDensity', 'negativeSpace',
          'asymmetry', 'typographyCharacter', 'annotationPresence', 'rhythm', 'ugcFeeling',
        ],
        properties: {
          id: { type: 'string' },
          hierarchy: stringArray,
          imageTextRatio: normalized,
          visualDensity: normalized,
          negativeSpace: normalized,
          asymmetry: normalized,
          typographyCharacter: stringArray,
          annotationPresence: normalized,
          rhythm: { type: 'string', enum: ['slow', 'balanced', 'fast', 'irregular'] },
          ugcFeeling: normalized,
        },
      },
    },
  },
}

export const directionsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['directions'],
  properties: {
    directions: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'name', 'concept', 'rationale', 'hierarchy', 'imageDominant', 'imageModes',
          'imageNotes', 'compositionStrategy', 'typographyCharacter', 'preservedRoles',
          'variableRoles',
        ],
        properties: {
          name: { type: 'string' },
          concept: { type: 'string' },
          rationale: { type: 'string' },
          hierarchy: stringArray,
          imageDominant: { type: 'boolean' },
          imageModes: stringArray,
          imageNotes: { type: 'string' },
          compositionStrategy: {
            type: 'string',
            enum: ['auto', 'centered', 'asymmetric', 'photo-dominant', 'typography-dominant'],
          },
          typographyCharacter: stringArray,
          preservedRoles: stringArray,
          variableRoles: stringArray,
        },
      },
    },
  },
}

export const compositionPlanSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['label', 'elements', 'imageRequests'],
  properties: {
    label: { type: 'string' },
    imageRequests: {
      type: 'array',
      maxItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'prompt', 'semanticRole'],
        properties: {
          id: { type: 'string' },
          prompt: { type: 'string' },
          semanticRole: { type: 'string', enum: ['photo', 'product'] },
        },
      },
    },
    elements: {
      type: 'array',
      minItems: 1,
      maxItems: 24,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id', 'type', 'semanticRole', 'x', 'y', 'width', 'height', 'rotation',
          'zIndex', 'opacity', 'content', 'assetId', 'fontFamily', 'fontWeight',
          'fontSize', 'lineHeight', 'letterSpacing', 'textAlign', 'color', 'fit',
          'cropX', 'cropY', 'zoom', 'borderRadius', 'shape', 'fill', 'stroke',
          'strokeWidth', 'annotationKind',
        ],
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['text', 'image', 'photo', 'product', 'logo', 'shape', 'annotation'] },
          semanticRole: { type: 'string' },
          x: normalized,
          y: normalized,
          width: normalized,
          height: normalized,
          rotation: { type: 'number', minimum: -180, maximum: 180 },
          zIndex: { type: 'integer', minimum: 0, maximum: 100 },
          opacity: normalized,
          content: { type: ['string', 'null'] },
          assetId: { type: ['string', 'null'] },
          fontFamily: { type: ['string', 'null'] },
          fontWeight: { type: ['number', 'null'] },
          fontSize: { type: ['number', 'null'], minimum: 12, maximum: 512 },
          lineHeight: { type: ['number', 'null'] },
          letterSpacing: { type: ['number', 'null'] },
          textAlign: { type: ['string', 'null'], enum: ['left', 'center', 'right', null] },
          color: { type: ['string', 'null'] },
          fit: { type: ['string', 'null'], enum: ['cover', 'contain', 'fill', null] },
          cropX: { type: ['number', 'null'] },
          cropY: { type: ['number', 'null'] },
          zoom: { type: ['number', 'null'] },
          borderRadius: { type: ['number', 'null'] },
          shape: { type: ['string', 'null'], enum: ['rectangle', 'circle', 'line', 'blob', null] },
          fill: { type: ['string', 'null'] },
          stroke: { type: ['string', 'null'] },
          strokeWidth: { type: ['number', 'null'] },
          annotationKind: {
            type: ['string', 'null'],
            enum: ['text', 'handwritten-text', 'arrow', 'circle', 'highlight', 'underline', 'scribble', null],
          },
        },
      },
    },
  },
}
