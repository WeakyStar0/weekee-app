import type { Item, User } from '@prisma/client';

type UserWithGear = User & {
  weapon: Item | null;
  pickaxe: Item | null;
  armor: Item | null;
  trinket: Item | null;
};

export interface CombatStats {
  totalDmg: number;
  totalDef: number;
  totalLuck: number;
  totalMagic: number;
  maxHp: number;
}

/** Base stats + equipment bonuses + trinket percentage modifier. */
export function computeCombatStats(user: UserWithGear): CombatStats {
  let totalDmg = user.baseDamage + (user.weapon?.mainStatValue ?? 0);
  let totalDef = user.baseDefense + (user.armor?.mainStatValue ?? 0);
  let totalLuck = user.baseLuck + (user.pickaxe?.mainStatValue ?? 0);
  const totalMagic = user.baseMagicDamage;
  let maxHp = user.baseHp + (user.level - 1);

  const trinketValue = user.trinket?.mainStatValue ?? 0;
  switch (user.trinket?.statModifierType) {
    case 'damage':
      totalDmg = Math.floor(totalDmg * (1 + trinketValue / 100));
      break;
    case 'defense':
      totalDef = Math.floor(totalDef * (1 + trinketValue / 100));
      break;
    case 'luck':
      totalLuck = Math.floor(totalLuck * (1 + trinketValue / 100));
      break;
    case 'health':
      maxHp = Math.floor(maxHp * (1 + trinketValue / 100));
      break;
  }

  return { totalDmg, totalDef, totalLuck, totalMagic, maxHp };
}
