// A small freehand whiteboard for showing working. Strokes are kept in a fixed
// "paper" coordinate space so the board can resize (phone ↔ laptop) without
// distorting, and so the exported image is always the same size.

import { useEffect, useRef, useState } from 'react';

export const BOARD_W = 1200;
export const BOARD_H = 675;
const PEN_WIDTH = 4;
const ERASER_WIDTH = 34;
const INK = '#241614';
const PAPER = '#fffdf8';

export interface Stroke {
  tool: 'pen' | 'eraser';
  points: [number, number][];
}

function paint(ctx: CanvasRenderingContext2D, strokes: Stroke[], scale: number) {
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, BOARD_W, BOARD_H);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    ctx.strokeStyle = s.tool === 'pen' ? INK : PAPER;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = s.tool === 'pen' ? PEN_WIDTH : ERASER_WIDTH;
    const [first, ...rest] = s.points;
    if (!first) continue;
    if (!rest.length) {
      ctx.beginPath();
      ctx.arc(first[0], first[1], ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(first[0], first[1]);
    // Smooth the line through midpoints so handwriting doesn't look jagged.
    for (let i = 0; i < rest.length - 1; i++) {
      const [x, y] = rest[i];
      const [nx, ny] = rest[i + 1];
      ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
    }
    const last = rest[rest.length - 1];
    ctx.lineTo(last[0], last[1]);
    ctx.stroke();
  }
  ctx.restore();
}

export const hasInk = (strokes: Stroke[]) => strokes.some((s) => s.tool === 'pen');

/** The board as a compact JPEG data URL, for the AI to read and for the report. */
export function boardToDataUrl(strokes: Stroke[]): string {
  const c = document.createElement('canvas');
  c.width = BOARD_W;
  c.height = BOARD_H;
  paint(c.getContext('2d')!, strokes, 1);
  return c.toDataURL('image/jpeg', 0.85);
}

export function Whiteboard({
  strokes,
  onChange,
  disabled = false,
  label = 'Whiteboard for your working',
}: {
  strokes: Stroke[];
  onChange: (s: Stroke[]) => void;
  disabled?: boolean;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Stroke['tool']>('pen');
  const [cleared, setCleared] = useState<Stroke[] | null>(null);
  const drawing = useRef<Stroke | null>(null);
  const latest = useRef(strokes);
  latest.current = strokes;

  const redraw = () => {
    const c = canvasRef.current;
    if (!c) return;
    const w = c.clientWidth;
    if (!w) return;
    const dpr = window.devicePixelRatio || 1;
    const pw = Math.round(w * dpr);
    const ph = Math.round((w * BOARD_H * dpr) / BOARD_W);
    if (c.width !== pw || c.height !== ph) {
      c.width = pw;
      c.height = ph;
    }
    const live = drawing.current ? [...latest.current, drawing.current] : latest.current;
    paint(c.getContext('2d')!, live, pw / BOARD_W);
  };

  useEffect(redraw);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => redraw());
    ro.observe(c);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toBoard = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * BOARD_W, ((e.clientY - r.top) / r.height) * BOARD_H];
  };

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Some pens/browsers refuse capture; drawing still works without it.
    }
    drawing.current = { tool, points: [toBoard(e)] };
    redraw();
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    const s = drawing.current;
    if (!s) return;
    const coalesced = e.nativeEvent.getCoalescedEvents?.() ?? [];
    const events = coalesced.length ? coalesced : [e.nativeEvent];
    const r = e.currentTarget.getBoundingClientRect();
    for (const ev of events) s.points.push([((ev.clientX - r.left) / r.width) * BOARD_W, ((ev.clientY - r.top) / r.height) * BOARD_H]);
    redraw();
  }
  function up() {
    const s = drawing.current;
    if (!s) return;
    drawing.current = null;
    setCleared(null);
    commit([...latest.current, s]);
  }

  // Update the local copy straight away so fast strokes never overwrite each other.
  function commit(next: Stroke[]) {
    latest.current = next;
    onChange(next);
  }
  function undo() {
    if (cleared) {
      commit(cleared);
      setCleared(null);
    } else commit(latest.current.slice(0, -1));
  }
  function clear() {
    if (!latest.current.length) return;
    setCleared(latest.current);
    commit([]);
  }

  return (
    <div className="whiteboard">
      <div className="wb-tools" role="toolbar" aria-label="Whiteboard tools">
        <button type="button" className={`wb-tool${tool === 'pen' ? ' on' : ''}`} aria-pressed={tool === 'pen'} onClick={() => setTool('pen')} disabled={disabled}>
          Pen
        </button>
        <button type="button" className={`wb-tool${tool === 'eraser' ? ' on' : ''}`} aria-pressed={tool === 'eraser'} onClick={() => setTool('eraser')} disabled={disabled}>
          Eraser
        </button>
        <span className="wb-spacer" />
        <button type="button" className="wb-tool" onClick={undo} disabled={disabled || (!strokes.length && !cleared)}>
          ↶ Undo
        </button>
        <button type="button" className="wb-tool" onClick={clear} disabled={disabled || !strokes.length}>
          Clear
        </button>
      </div>
      <div className="wb-surface">
        <canvas
          ref={canvasRef}
          className={`wb-canvas${tool === 'eraser' ? ' erasing' : ''}`}
          role="img"
          aria-label={label}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
        {!strokes.length && <p className="wb-empty">Write your working here with a mouse, finger or stylus.</p>}
      </div>
    </div>
  );
}
