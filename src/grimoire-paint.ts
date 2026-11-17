import {
  LAST_PAGE,
  SCHOOLS,
  type CastState,
  castCount,
  isSchoolCast,
} from './grimoire-content.js';

const PARCHMENT = '#f6e7c8';
const INK = '#1a100c';
const FAINT = '#3f2c1e';
const RULE = '#c4a46a';

function paper(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, 512, 512);
  ctx.fillStyle = PARCHMENT;
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 8;
  ctx.strokeRect(28, 28, 456, 456);
  ctx.strokeStyle = '#e7d3a4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let y = 120; y <= 430; y += 36) {
    ctx.moveTo(64, y);
    ctx.lineTo(448, y);
  }
  ctx.stroke();
}

function title(ctx: CanvasRenderingContext2D, text: string, color = INK): void {
  ctx.fillStyle = color;
  ctx.font = '700 48px Georgia, "Palatino Linotype", serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 256, 112);
}

function paragraph(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  startY: number,
  color = INK,
  size = 28,
): void {
  ctx.fillStyle = color;
  ctx.font = `${size}px Georgia, "Palatino Linotype", serif`;
  ctx.textAlign = 'center';
  lines.forEach((line, index) => {
    ctx.fillText(line, 256, startY + index * (size + 12));
  });
}

export function paintRightPage(
  ctx: CanvasRenderingContext2D,
  page: number,
  state: CastState,
): void {
  paper(ctx);
  if (page <= 0) {
    ctx.fillStyle = INK;
    ctx.font = '700 46px Georgia, "Palatino Linotype", serif';
    ctx.textAlign = 'center';
    ctx.fillText('Aether Grimoire', 256, 108);
    paragraph(
      ctx,
      ['This book answers only a hand.', 'Pinch the gold corner', 'on the lower right.'],
      360,
      FAINT,
      26,
    );
    return;
  }

  if (page >= LAST_PAGE) {
    title(ctx, 'Binding', state.bound ? '#8a5a12' : INK);
    paragraph(
      ctx,
      state.bound
        ? ['The four inks are one.', 'Come back on a new day.', 'It will keep another star.']
        : castCount(state) === 4
          ? ['All four seals answer.', 'Pinch the seal', 'to wake the book.']
          : ['The binding stays shut', 'until ember, gale,', 'tide, and veil answer.'],
      360,
      FAINT,
      26,
    );
    return;
  }

  const school = SCHOOLS[page - 1];
  if (!school) return;
  const answered = isSchoolCast(state, school.id);
  title(ctx, school.title.replace(' Seal', ''), school.ink);
  ctx.fillStyle = school.ink;
  ctx.font = '700 28px Georgia, "Palatino Linotype", serif';
  ctx.textAlign = 'center';
  ctx.fillText(answered ? 'ANSWERED' : 'PINCH THE SEAL', 256, 168);
  const words = school.line.split('. ');
  paragraph(ctx, words.map((word) => word.replace(/\.$/, '')), 360, FAINT, 26);
}

export function paintLeftPage(
  ctx: CanvasRenderingContext2D,
  state: CastState,
  stars: number,
): void {
  paper(ctx);
  title(ctx, 'Index');
  ctx.textAlign = 'left';
  ctx.font = '28px Georgia, "Palatino Linotype", serif';
  SCHOOLS.forEach((school, index) => {
    const y = 240 + index * 48;
    ctx.fillStyle = isSchoolCast(state, school.id) ? school.ink : '#cabb9e';
    ctx.beginPath();
    ctx.arc(86, y - 8, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.fillText(school.title, 116, y);
  });
  ctx.fillStyle = FAINT;
  ctx.font = '24px Georgia, "Palatino Linotype", serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    state.bound ? `Awake - dawn stars ${stars}` : `Seals ${castCount(state)} / 4 - stars ${stars}`,
    256,
    460,
  );
}
