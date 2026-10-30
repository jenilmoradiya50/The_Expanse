/**
 * Standard utility helpers for The Expanse
 */

export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(" ");
}
