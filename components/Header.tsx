import { BORDER_300 } from "@/helpers/styling";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Header(props: { logout?: (() => void) | null }) {
  const { logout } = props;
  const subheaders = [
    "it's a memorable domain! (and it was $5 off)",
    "better algorithms make better people",
    "the skyline is the timeline on bluesky",
  ];
  const [subheader, setSubheader] = useState<string>("");
  useEffect(() => {
    setSubheader(subheaders[Math.floor(Math.random() * subheaders.length)]);
  }, []);

  return (
    <div className="w-full flex flex-row items-center justify-center">
      <div className="sm:flex-1"></div>
      <div className="flex flex-col items-start sm:items-center py-4">
        <Link href="/" className="text-xl font-light">
          {/* spells skyline.gay in pride flag colors */}
          <span className="text-red-500">s</span>
          <span className="text-orange-500">k</span>
          <span className="text-yellow-500">y</span>
          <span className="text-green-500">l</span>
          <span className="text-blue-500">i</span>
          <span className="text-purple-500">n</span>
          <span className="text-pink-500">e</span>
        </Link>
        <div className="text-sm font-light text-slate-900 dark:text-slate-300">
          {subheader}
        </div>
      </div>
      <div className="flex-1 flex flex-row justify-end items-center">
        {logout && (
          <button
            className={
              "text-base border py-2 px-4 rounded-lg flex flex-row items-center ml-4 mr-0 sm:mr-3 text-slate-800 bg-white dark:text-slate-50 dark:bg-slate-800 outline-none " +
              BORDER_300
            }
            onClick={() => logout()}
          >
            <span className="material-icons mr-2">logout</span>
            Logout
          </button>
        )}
      </div>
    </div>
  );
}
