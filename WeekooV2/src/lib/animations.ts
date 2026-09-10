// Same custom emoji IDs as V1 — application-owned emojis, carry over since
// V2 reuses the same bot application. NOT yet visually confirmed in V2's dev
// guild (unlike the profile emojis) — check on first real /adventure test.

interface DimensionSprites {
  TOP: string;
  BOT: string;
  STONE: string;
}

const PLAYER_WALK = '<a:kirby_walk:1468292617254211750>';
const PLAYER_DRILL = '<a:kirby_mine:1468292614565396583>';
const PLAYER_IDLE = '<a:kirby_dance:1468298440101331015>';
const SKY = '<:empty_emoji:1468293846491463874>';

const DIMENSION_SPRITES: Record<string, DimensionSprites> = {
  Overworld: {
    TOP: '<:block_grass:1468277009124688127>',
    BOT: '<:block_dirt:1468275701680443557>',
    STONE: '<:block_stone:1468275695632384090>',
  },
  Nether: {
    TOP: '<:block_netherrack:1468275696915845345>',
    BOT: '<:block_netherrack:1468275696915845345>',
    STONE: '<:block_netherrack:1468275696915845345>',
  },
  'The End': {
    TOP: '<:block_end_stone:1468275703350038633>',
    BOT: '<:block_end_stone:1468275703350038633>',
    STONE: '<:block_end_stone:1468275703350038633>',
  },
  Frostveil: {
    TOP: '<:block_snow:1468389185026265179>',
    BOT: '<:block_ice:1468389183578968124>',
    STONE: '<:block_ice:1468389183578968124>',
  },
  Faywood: {
    TOP: '🍃',
    BOT: '🪵',
    STONE: '🌿',
  },
};

export function getWalkingScene(dimensionName: string, isMoving = true): string {
  const dim = DIMENSION_SPRITES[dimensionName] ?? DIMENSION_SPRITES.Overworld;
  const playerSprite = isMoving ? PLAYER_WALK : PLAYER_IDLE;

  const row1 = SKY.repeat(7);
  const row2 = `${SKY.repeat(3)}${playerSprite}${SKY.repeat(3)}`;
  const row3 = dim.TOP.repeat(7);
  const row4 = dim.BOT.repeat(7);

  return `${row1}\n${row2}\n${row3}\n${row4}`;
}

/** frame: 0 (surface), 1 (digging), or 2 (deep). isDrilling false = idle/result pose. */
export function getMiningScene(dimensionName: string, frame: 0 | 1 | 2, isDrilling = true): string {
  const dim = DIMENSION_SPRITES[dimensionName] ?? DIMENSION_SPRITES.Overworld;
  const block = dim.STONE;
  const player = isDrilling ? PLAYER_DRILL : PLAYER_IDLE;

  const solidRow = (emoji: string) => emoji.repeat(7);
  const playerRow = (bgEmoji: string) => `${bgEmoji.repeat(3)}${player}${bgEmoji.repeat(3)}`;

  if (frame === 0) {
    return `${playerRow(block)}\n${solidRow(block)}\n${solidRow(block)}\n${solidRow(block)}`;
  }
  if (frame === 1) {
    return `${solidRow(SKY)}\n${playerRow(block)}\n${solidRow(block)}\n${solidRow(block)}`;
  }
  return `${solidRow(SKY)}\n${solidRow(SKY)}\n${playerRow(block)}\n${solidRow(block)}`;
}
