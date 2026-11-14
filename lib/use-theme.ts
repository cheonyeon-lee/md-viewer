"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme-script";

type Listener = () => void;

const listeners = new Set<Listener>();

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

// SSR 및 hydration 시점에는 layout.tsx의 beforeInteractive 스크립트가 아직 실제 값을 반영하기 전이므로
// 고정값을 반환한다. mount 직후 useSyncExternalStore가 자동으로 getSnapshot()의 실제 값으로 다시 렌더링한다.
function getServerSnapshot() {
  return true;
}

/** 현재 다크 모드 여부를 <html class="dark"> 기준으로 구독한다. */
export function useIsDarkTheme(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** 테마를 변경하고 localStorage에 저장한 뒤 구독자에게 알린다. */
export function setDarkTheme(isDark: boolean) {
  document.documentElement.classList.toggle("dark", isDark);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
  } catch {
    // 개인정보 보호 모드 등에서 localStorage 접근이 막힐 수 있음 - 화면 전환은 유지
  }
  listeners.forEach((listener) => listener());
}
