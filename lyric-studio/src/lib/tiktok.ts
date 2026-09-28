/** Output frame: TikTok / Reels / Shorts vertical 9:16. */
export const W = 1080;
export const H = 1920;

/**
 * Area TikTok's UI never covers on a 1080×1920 video.
 * top: "Following | For You" tabs + search
 * bottom: username, caption, sound ticker (grows with long captions, so this is generous)
 * right: avatar / like / comment / save / share rail
 * left: small margin so text doesn't touch the edge
 */
export const SAFE = {
  top: 160,
  bottom: 480,
  left: 60,
  right: 150,
};

export const SAFE_RECT = {
  x: SAFE.left,
  y: SAFE.top,
  w: W - SAFE.left - SAFE.right,
  h: H - SAFE.top - SAFE.bottom,
  get right() {
    return this.x + this.w;
  },
  get bottom() {
    return this.y + this.h;
  },
};

/** Draws the unsafe regions plus a rough mock of TikTok's UI (preview only, never exported). */
export function drawSafeZoneOverlay(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 45, 85, 0.16)';
  ctx.fillRect(0, 0, W, SAFE.top);
  ctx.fillRect(0, H - SAFE.bottom, W, SAFE.bottom);
  ctx.fillRect(0, SAFE.top, SAFE.left, H - SAFE.top - SAFE.bottom);
  ctx.fillRect(W - SAFE.right, SAFE.top, SAFE.right, H - SAFE.top - SAFE.bottom);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.setLineDash([18, 14]);
  ctx.lineWidth = 3;
  ctx.strokeRect(SAFE_RECT.x, SAFE_RECT.y, SAFE_RECT.w, SAFE_RECT.h);
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  // top tabs
  ctx.font = '600 40px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Following   For You', W / 2, 95);
  // right rail
  const railX = W - 75;
  [900, 1060, 1200, 1340, 1480].forEach((y, i) => {
    ctx.beginPath();
    ctx.arc(railX, y, i === 0 ? 48 : 38, 0, Math.PI * 2);
    ctx.fill();
  });
  // bottom caption mock
  ctx.textAlign = 'left';
  ctx.fillText('@yourname', 40, H - 330);
  ctx.fillRect(40, H - 280, 640, 26);
  ctx.fillRect(40, H - 238, 480, 26);
  ctx.fillText('♫  original sound', 40, H - 160);
  ctx.restore();
}
