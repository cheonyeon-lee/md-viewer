export const THEME_STORAGE_KEY = "md-viewer-theme";

// html의 dark 클래스는 hydration 이전에 설정되어야 라이트/다크 전환 시 깜빡임(FOUC)이 없다.
// 기본 모드는 다크: 저장된 사용자 선택이 없으면 시스템 설정과 무관하게 dark로 시작한다.
export const themeInitScript = `(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var theme = stored === "light" || stored === "dark" ? stored : "dark";
    document.documentElement.classList.toggle("dark", theme === "dark");
  } catch (e) {}
})();`;
