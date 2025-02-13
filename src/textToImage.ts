import fs from 'fs';
import Canvas from 'canvas';
import { Canvas as CanvasType } from 'canvas/types';

interface GenerateOptions {
  bgColor?: string | CanvasGradient | CanvasPattern;
  customHeight?: number;
  debug?: boolean;
  debugFilename?: string;
  fontFamily?: string;
  fontPath?: string;
  fontSize?: number;
  fontWeight?: string | number;
  lineHeight?: number;
  margin?: number;
  maxWidth?: number;
  textAlign?: CanvasTextAlign;
  textColor?: string;
  verticalAlign?: string;
}

type GenerateOptionsRequired = Required<GenerateOptions>;

const defaults = {
  bgColor: '#fff',
  customHeight: 0,
  debug: false,
  debugFilename: '',
  fontFamily: 'Courier',
  fontPath: '',
  fontSize: 18,
  fontWeight: 'normal',
  lineHeight: 18,
  margin: 10,
  maxWidth: 800,
  textAlign: 'left' as const,
  textColor: '#000',
  verticalAlign: 'top',
};

const createTextData = (
  text: string,
  config: GenerateOptionsRequired,
  canvas?: CanvasType,
) => {
  const {
    bgColor,
    fontFamily,
    fontPath,
    fontSize,
    fontWeight,
    lineHeight,
    maxWidth,
    textAlign,
    textColor,
  } = config;

  // Register a custom font
  if (fontPath) {
    Canvas.registerFont(fontPath, { family: fontFamily });
  }

  // Use the supplied canvas (which should have a suitable width and height)
  // for the final image
  // OR
  // create a temporary canvas just for measuring how long the canvas needs to be
  const textCanvas = canvas || Canvas.createCanvas(maxWidth, 100);
  const textContext = textCanvas.getContext('2d');

  // set the text alignment and start position
  let textX = 0;
  let textY = 0;

  if (['center'].includes(textAlign.toLowerCase())) {
    textX = maxWidth / 2;
  }
  if (['right', 'end'].includes(textAlign.toLowerCase())) {
    textX = maxWidth;
  }
  textContext.textAlign = textAlign;

  // set background color
  textContext.fillStyle = bgColor;
  textContext.fillRect(0, 0, textCanvas.width, textCanvas.height);

  // set text styles
  textContext.fillStyle = textColor;
  textContext.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  textContext.textBaseline = 'top';
  const lines = text.split('\n');
  let lineCount = lines.length;

  for (let n = 0; n < lineCount; n += 1) {
    let line = lines[n];
    textContext.fillText(`${line} `, textX, textY);
    if(n < lineCount - 1) {
      textY += lineHeight;
    }
  }
  const height = textY + Math.max(lineHeight, fontSize);
  return {
    textHeight: height,
    textData: textContext.getImageData(0, 0, maxWidth, height),
  };
};

const createCanvas = (content: string, conf: GenerateOptionsRequired) => {
  // First pass: measure the text so we can create a canvas
  // big enough to fit the text. This has to be done since we can't
  // resize the canvas on the fly without losing the settings of the 2D context
  // https://github.com/Automattic/node-canvas/issues/1625
  const { textHeight } = createTextData(
    content,
    // max width of text itself must be the image max width reduced by left-right margins
    <GenerateOptionsRequired>{
      maxWidth: conf.maxWidth - conf.margin * 2,
      fontSize: conf.fontSize,
      lineHeight: conf.lineHeight,
      bgColor: conf.bgColor,
      textColor: conf.textColor,
      fontFamily: conf.fontFamily,
      fontPath: conf.fontPath,
      fontWeight: conf.fontWeight,
      textAlign: conf.textAlign,
    },
  );

  const textHeightWithMargins = textHeight + conf.margin * 2;

  if (conf.customHeight && conf.customHeight < textHeightWithMargins) {
    // eslint-disable-next-line no-console
    console.warn('Text is longer than customHeight, clipping will occur.');
  }

  // Second pass: we now know the height of the text on the canvas,
  // so let's create the final canvas with the given height and width
  // and pass that to createTextData so we can get the text data from it
  const canvas = Canvas.createCanvas(
    conf.maxWidth,
    conf.customHeight || textHeightWithMargins,
  );

  const { textData } = createTextData(
    content,
    // max width of text itself must be the image max width reduced by left-right margins
    <GenerateOptionsRequired>{
      maxWidth: conf.maxWidth - conf.margin * 2,
      fontSize: conf.fontSize,
      lineHeight: conf.lineHeight,
      bgColor: conf.bgColor,
      textColor: conf.textColor,
      fontFamily: conf.fontFamily,
      fontPath: conf.fontPath,
      fontWeight: conf.fontWeight,
      textAlign: conf.textAlign,
    },
    canvas,
  );
  const ctx = canvas.getContext('2d');

  ctx.globalAlpha = 1;
  ctx.fillStyle = conf.bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const textX = conf.margin;
  let textY = conf.margin;
  if (conf.customHeight && conf.verticalAlign === 'center') {
    textY =
      // divide the leftover whitespace by 2
      (conf.customHeight - textData.height) / 2 +
      // offset for the extra space under the last line to make bottom and top whitespace equal
      // but only up until the bottom of the text
      // (i.e. don't consider a linheight less than the font size)
      Math.max(0, (conf.lineHeight - conf.fontSize) / 2);
  }

  ctx.putImageData(textData, textX, textY);

  return canvas;
};

export const generate = async (
  content: string,
  config: GenerateOptions,
): Promise<string> => {
  const conf = { ...defaults, ...config };
  const canvas = createCanvas(content, conf);
  const dataUrl = canvas.toDataURL();

  if (conf.debug) {
    const fileName =
      conf.debugFilename ||
      `${new Date().toISOString().replace(/[\W.]/g, '')}.png`;
    await fs.promises.writeFile(fileName, canvas.toBuffer());
  }

  return dataUrl;
};

export const generateSync = (
  content: string,
  config: GenerateOptions,
): string => {
  const conf: GenerateOptionsRequired = { ...defaults, ...config };
  const canvas = createCanvas(content, conf);
  const dataUrl = canvas.toDataURL();

  if (conf.debug) {
    const fileName =
      conf.debugFilename ||
      `${new Date().toISOString().replace(/[\W.]/g, '')}.png`;
    fs.writeFileSync(fileName, canvas.toBuffer());
  }

  return dataUrl;
};
