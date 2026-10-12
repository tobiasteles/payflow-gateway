import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Mocks de APIs de navegador que o JSDOM não implementa
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverMock);
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
Element.prototype.scrollIntoView = vi.fn();

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
