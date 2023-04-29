import { ReactNode } from "react";

export default function Modal(props: {
  children: ReactNode;
  close: () => void;
}) {
  const { children, close } = props;
  return (
    <div
      className="fixed top-0 left-0 p-4 w-screen h-screen bg-black/50 backdrop-blur-md flex flex-row justify-center items-center"
      onClick={() => close()}
    >
      <div
        className="flex-1 rounded-lg p-4 max-w-lg dark:border-2 dark:border-slate-600 bg-white dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {props.children}
      </div>
    </div>
  );
}