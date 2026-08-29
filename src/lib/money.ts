import type { DiscountType, EditorLineItem } from "@/lib/types";

const pow10 = (n: number) => 10n ** BigInt(n);

export function decimalToScaled(value: string | number, scale: number): bigint {
  const raw = String(value ?? "0").trim();
  if (!raw) return 0n;
  const match = raw.match(/^([+-]?)(\d*)(?:\.(\d*))?$/);
  if (!match) return 0n;
  const sign = match[1] === "-" ? -1n : 1n;
  const whole = match[2] || "0";
  const fraction = match[3] || "";
  const kept = (fraction + "0".repeat(scale)).slice(0, scale);
  let result = BigInt(whole) * pow10(scale) + BigInt(kept || "0");
  const nextDigit = fraction.length > scale ? Number(fraction[scale]) : 0;
  if (nextDigit >= 5) result += 1n;
  return sign * result;
}

function roundDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) return 0n;
  if (numerator < 0n) return -roundDivide(-numerator, denominator);
  return (numerator + denominator / 2n) / denominator;
}

export function lineTotalCents(quantity: string, unitPrice: string): bigint {
  const q = decimalToScaled(quantity, 4);
  const p = decimalToScaled(unitPrice, 4);
  const result = roundDivide(q * p, pow10(6));
  return result < 0n ? 0n : result;
}

export function centsToFixed(cents: bigint): string {
  const sign = cents < 0n ? "-" : "";
  const abs = cents < 0n ? -cents : cents;
  return `${sign}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
}

export function calculateTotals(
  items: Pick<EditorLineItem, "quantity" | "unit_price">[],
  discountType: DiscountType,
  discountValue: string,
  taxRate: string
) {
  const subtotalCents = items.reduce((sum, item) => sum + lineTotalCents(item.quantity, item.unit_price), 0n);
  let discountCents = 0n;
  if (discountType === "percentage") {
    const pct = decimalToScaled(discountValue, 4);
    const boundedPct = pct < 0n ? 0n : pct > 1_000_000n ? 1_000_000n : pct;
    discountCents = roundDivide(subtotalCents * boundedPct, 100n * pow10(4));
  } else if (discountType === "fixed") {
    const fixed = decimalToScaled(discountValue, 2);
    discountCents = fixed < 0n ? 0n : fixed > subtotalCents ? subtotalCents : fixed;
  }
  const discountedCents = subtotalCents - discountCents;
  const tax = decimalToScaled(taxRate, 4);
  const boundedTax = tax < 0n ? 0n : tax > 1_000_000n ? 1_000_000n : tax;
  const taxCents = roundDivide(discountedCents * boundedTax, 100n * pow10(4));
  const grandTotalCents = discountedCents + taxCents;
  return {
    subtotalCents,
    discountCents,
    discountedCents,
    taxCents,
    grandTotalCents,
    subtotal: centsToFixed(subtotalCents),
    discount: centsToFixed(discountCents),
    tax: centsToFixed(taxCents),
    grandTotal: centsToFixed(grandTotalCents)
  };
}

export function formatMoney(value: string | number, currency = "USD") {
  const numeric = Number(value || 0);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: 2 }).format(numeric);
  } catch {
    return `${currency} ${numeric.toFixed(2)}`;
  }
}
