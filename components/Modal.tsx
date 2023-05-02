import { ReactNode, useEffect } from "react";

export default function Modal(props: {
  children: ReactNode;
  close: () => void;
}) {
  const { children, close } = props;

  useEffect(() => {
    // stop scroll on body while open
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  return (
    <div
      className="fixed top-0 left-0 p-4 py-8 w-screen h-screen bg-black/50 backdrop-blur-md flex flex-row justify-center items-center z-50"
      onClick={() => close()}
    >
      <div
        className="flex-1 rounded-lg p-4 max-w-lg max-h-full dark:border-2 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {props.children}
      </div>
    </div>
  );
}
