"use client";

import { useSyncExternalStore } from "react";

// One "Business" switch for the Calendar and To do cards: flip it on either
// and both follow. Remembered on this device; on by default.

const KEY = "jm-show-business";
let listeners: (() => void)[] = [];

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setShowBusiness(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Private mode: the switch still works until the page reloads.
  }
  memory = on;
  listeners.forEach((l) => l());
}

let memory: boolean | null = null;

function subscribe(cb: () => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

export function useShowBusiness(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => memory ?? read(),
    () => true,
  );
}
