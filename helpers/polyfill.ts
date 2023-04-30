import Graphemer from "graphemer";
import { useEffect } from "react";

export function useFirefoxPolyfill() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      let globalThis = window as any;

      const splitter = new Graphemer();
      globalThis.Intl = globalThis.Intl || {};

      globalThis.Intl.Segmenter =
        globalThis.Intl.Segmenter ||
        class Segmenter {
          constructor() {}
          segment(s: string) {
            return splitter.iterateGraphemes(s);
          }
        };
    }
  }, []);
}
