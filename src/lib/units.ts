/**
 * Convert recipe ingredient amounts (small units) to inventory storage units.
 * g → kg (÷ 1000), ml → liters (÷ 1000), everything else 1:1 (e.g. pieces).
 * Used by the recipe editor (menu page) and inventory deduction (POS page).
 */
export function toInventoryAmount(
  amount: number,
  amountUnit: string,
  inventoryUnit: string
): number {
  const au = amountUnit.toLowerCase();
  const iu = inventoryUnit.toLowerCase();
  if (au === "g" && iu === "kg") return amount / 1000;
  if (au === "ml" && (iu === "liters" || iu === "litres" || iu === "l" || iu === "liter"))
    return amount / 1000;
  return amount;
}

/**
 * Suggest the right small unit to enter based on the inventory item's storage unit.
 * kg → g, liters → ml, everything else → pieces.
 */
export function suggestUnit(inventoryUnit: string): "g" | "ml" | "pieces" {
  const u = inventoryUnit.toLowerCase();
  if (u === "kg") return "g";
  if (u === "liters" || u === "litres" || u === "l" || u === "liter") return "ml";
  return "pieces";
}

/**
 * Human-readable conversion hint for the recipe editor ("= 0.025 kg").
 * Returns empty string when no conversion is needed.
 */
export function conversionHint(
  amount: number,
  amountUnit: string,
  inventoryUnit: string
): string {
  const converted = toInventoryAmount(amount, amountUnit, inventoryUnit);
  if (converted === amount) return "";
  const displayUnit =
    inventoryUnit === "liters" || inventoryUnit === "litres" ? "L" : inventoryUnit;
  const str = converted.toFixed(4).replace(/\.?0+$/, "");
  return `= ${str} ${displayUnit}`;
}
