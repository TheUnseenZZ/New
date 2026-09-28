/** A single sung word with its timing, in seconds from the start of the video. */
export interface Word {
  text: string;
  start: number;
  end: number;
  /** Payoff override for this word: true = always a payoff, false = never, missing = automatic. */
  emph?: boolean;
}

/** A lyric line as shown in the editor. Templates may split it further (chunks / single words). */
export interface Line {
  id: string;
  words: Word[];
}

export type EnterAnim =
  | 'none'
  | 'fade'
  | 'pop'
  | 'slam'
  | 'zoom'
  | 'slideUp'
  | 'slideDown'
  | 'blur'
  | 'drop'
  | 'spin'
  | 'glitch'
  | 'typewriter'
  | 'flyIn'
  | 'flip'
  | 'stretch'
  | 'swing';

export type ExitAnim = 'none' | 'fade' | 'blur' | 'slideUp' | 'shrink' | 'scatter' | 'fall' | 'pop';

/**
 * Where words go on screen.
 * block = normal centered text · scatter = words spread around the frame in mixed sizes
 * stairs = each word steps diagonally · zigzag = words alternate left/right edges
 * orbit = words circle the center · wander = each group lands somewhere new
 * bounce = the text drifts and bounces off the edges like the DVD logo
 */
export type Placement = 'block' | 'scatter' | 'stairs' | 'zigzag' | 'orbit' | 'wander' | 'bounce';

export type Easing = 'linear' | 'easeOut' | 'easeInOut' | 'back' | 'elastic' | 'bounce';

/**
 * A caption template is pure data, so anyone (including Claude) can write new ones
 * without touching renderer code. See TEMPLATES.md for the field-by-field guide.
 */
export interface Template {
  id: string;
  name: string;
  /** One-line description of the vibe, shown in the gallery. */
  vibe: string;
  tags?: string[];

  font: {
    /** Any Google Fonts family name, e.g. "Anton" or "Playfair Display". */
    family: string;
    weight: number;
    italic?: boolean;
    /** Font size in px on a 1080×1920 frame. Auto-shrinks to fit the safe zone. */
    size: number;
    /** Multiplier of font size. Default 1.1 */
    lineHeight?: number;
    /** In em. Default 0 */
    letterSpacing?: number;
    case?: 'upper' | 'lower' | 'none';
  };

  color: {
    fill: string;
    /** Vertical gradient stops (top → bottom). Overrides `fill` when set. */
    gradient?: string[];
    /** Cycles a fill color per caption group (e.g. alternating colors on each word). */
    palette?: string[];
    stroke?: { color: string; width: number };
    shadow?: { color: string; blur: number; x: number; y: number };
    glow?: { color: string; blur: number };
    /** Cycles colors letter by letter. */
    letterPalette?: string[];
    /**
     * Canvas blend mode for the text, e.g. "multiply" makes dark text look projected onto a
     * bright wall; "overlay"/"screen"/"difference" for other looks. Default normal.
     */
    blend?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'difference' | 'soft-light';
    /** Solid card behind the whole group (e.g. white text on a red panel). */
    card?: { color: string; padding?: number; radius?: number };
  };

  /**
   * Payoff words get their own moment: optionally cut the frame to a solid color and restyle the word.
   * trigger "lineEnd" = last word of every lyric line; "marked" = only words the user wraps in *stars*.
   * Marked words always count, whatever the trigger.
   */
  emphasis?: {
    /** "none" = only words the user explicitly turns on */
    trigger: 'lineEnd' | 'marked' | 'none';
    /** Fill the whole frame with this color while the word is on screen (e.g. "#000" blackout). */
    background?: string;
    fill?: string;
    scale?: number;
    /** Hide the card for the emphasized word. */
    noCard?: boolean;
  };

  layout: {
    /** line = whole lyric line, chunk = up to maxWords at a time, word = one word at a time */
    mode: 'line' | 'chunk' | 'word';
    maxWords?: number;
    anchor: 'upper' | 'center' | 'lower';
    align?: 'center' | 'left';
    /** Fraction (0–1) of the TikTok safe-zone width the text may use. Default 0.9 */
    maxWidth?: number;
    /** Max wrapped rows before the font shrinks. Default 3 */
    maxLines?: number;
    /** Spread each row's words evenly across the full width ("NOW    WE    AIN'T"). */
    spread?: boolean;
    /** Where words go on screen. Default block. */
    placement?: Placement;
    /** 0–1 random size variation per word (great with scatter). */
    sizeJitter?: number;
    /** orbit: turns per second · bounce: speed multiplier. Default 1 */
    speed?: number;
  };

  /** all = whole group appears at once, word = each word appears as it's sung, char = typewriter */
  reveal: 'all' | 'word' | 'char';

  /** Words in the visible group that haven't been sung yet (only matters for reveal "all"). */
  upcoming?: { opacity: number };

  /** How the word currently being sung stands out. */
  active?: {
    /** color = only current word, sung = all sung words (karaoke fill), box = highlight box */
    mode: 'none' | 'color' | 'sung' | 'box' | 'underline';
    color?: string;
    boxColor?: string;
    boxPadding?: number;
    boxRadius?: number;
    /** Scale bump on the active word, e.g. 1.15 */
    scale?: number;
  };

  enter: {
    anim: EnterAnim;
    /** ms */
    duration: number;
    easing?: Easing;
    /** ms between words when reveal = "all" */
    stagger?: number;
    /** ms between letters: animates each letter separately (letters pop/fly/drop in one by one). */
    letterStagger?: number;
  };

  exit: {
    anim: ExitAnim;
    duration: number;
    /** Let the exit keep playing while the next group comes in (words fly/fall away behind it). */
    overlap?: boolean;
  };

  timing?: {
    /** Seconds the text appears before it is sung. Default 0.05 */
    lead?: number;
    /** Max seconds a group stays after its last word when nothing follows. Default 0.6 */
    hold?: number;
  };

  fx?: {
    /** px of jitter when a group appears */
    shake?: number;
    /** ms the shake lasts. Default 180 */
    shakeDuration?: number;
    /** px offset of red/cyan copies */
    rgbSplit?: number;
    /** 0–1 chance per tick that a word dims */
    flicker?: number;
    /** degrees of continuous sway */
    wobble?: number;
    /** max random degrees each group is tilted */
    tilt?: number;
    /** px of gentle vertical floating */
    float?: number;
    /** px of constant blur, for soft projected/out-of-focus text */
    soften?: number;
    /** px amplitude of a wave running through the letters */
    wave?: number;
    /** 0–1 squash-and-stretch wobble when a word lands */
    jelly?: number;
    /** px per second each word slowly drifts in its own direction */
    drift?: number;
  };

  /** Effects applied to the video frame itself. */
  frame?: {
    /** 0–1 black overlay so text pops */
    dim?: number;
    /** Zoom kick on each new group, e.g. 0.05 = 5% */
    punchZoom?: number;
    /** 0–1 film grain */
    grain?: number;
    /** 0–1 dark edges */
    vignette?: number;
    /** 0–1 white flash on each new group */
    flash?: number;
  };
}

/** Per-project knobs the user tweaks on top of a template. */
export interface Settings {
  templateId: string;
  fit: 'cover' | 'contain';
  /** Fraction of safe-zone height, -0.5..0.5 */
  yOffset: number;
  sizeScale: number;
  /** Seconds added to every word (fixes global sync drift). */
  timingOffset: number;
  stripPunctuation: boolean;
  showSafeZone: boolean;
  colorOverride: { enabled: boolean; fill: string; accent: string };
  /** Per-style customizations from the UI. Reset when switching templates. */
  style: StyleOverrides;
}

export interface StyleOverrides {
  fontFamily?: string;
  fontWeight?: number;
  italic?: boolean;
  case?: 'upper' | 'lower' | 'none';
  mode?: 'line' | 'chunk' | 'word';
  enter?: EnterAnim;
  placement?: Placement;
  /** When payoff moments happen: template default, every line end, or only words you pick */
  payoffs?: 'template' | 'lineEnd' | 'picked';
  /** Payoff background: template default, keep the video, or a color ("accent" = accent color) */
  payoffBg?: 'template' | 'none' | 'accent' | string;
}

export const DEFAULT_SETTINGS: Settings = {
  templateId: 'blackout',
  fit: 'cover',
  yOffset: 0,
  sizeScale: 1,
  timingOffset: 0,
  stripPunctuation: true,
  showSafeZone: true,
  colorOverride: { enabled: false, fill: '#ffffff', accent: '#ffe600' },
  style: {},
};
