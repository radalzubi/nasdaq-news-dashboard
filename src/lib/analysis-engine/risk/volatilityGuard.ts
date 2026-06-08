import type { VolatilityRead } from "../core/types";

/** Caps confidence when volatility makes signals unreliable. */
export function volatilityGuard(vol: VolatilityRead): { warning: string | null; clarityCap: number | null } {
  if (vol.regime === "Extreme") return { warning: "Volatility is extreme — treat any signal with caution.", clarityCap: 55 };
  if (vol.regime === "Elevated") return { warning: "Volatility is elevated — moves may be larger than usual.", clarityCap: null };
  return { warning: null, clarityCap: null };
}
