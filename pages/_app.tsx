import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Analytics } from "@vercel/analytics/react";
import { useEffect } from "react";
import Graphemer from "graphemer";

export default function App({ Component, pageProps }: AppProps) {
  // polyfill for firefox
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
  return (
    <>
      <Component {...pageProps} />
      <Analytics />
    </>
  );
}
