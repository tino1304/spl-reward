import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import * as BufferLayout from "@solana/buffer-layout";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function toFixed(num: number, fixed: number): string {
  const re = new RegExp(`^-?\\d+(?:\\.\\d{0,${fixed || -1}})?`);
  return num.toString().match(re)![0];
}

export function shorten(s: string | undefined, max = 12) {
  if (!s) return "";
  return s.length > max
    ? `${s.substring(0, max / 2 - 1)}…${s.substring(
        s.length - max / 2 + 2,
        s.length
      )}`
    : s;
}

/**
 * Layout for a 64bit unsigned value
 */
export const uint64 = (property: string = 'uint64'): object => {
  return BufferLayout.blob(8, property);
};