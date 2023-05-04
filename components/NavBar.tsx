import { LanguageType } from "@/helpers/classifyLanguage";
import { TimelineConfigsType } from "@/helpers/makeFeeds";
import { BORDER_200, BORDER_300 } from "@/helpers/styling";
import { TimelineDefinitionsType, TimelineIdType } from "@/helpers/timelines";
import Image from "next/image";
import Link from "next/link";
import TimelinePicker from "./TimelinePicker";

export default function NavBar(props: {
  egoHandle: string;
  timelineId: TimelineIdType;
  setTimelineId: (timelineId: TimelineIdType) => void;
  customTimelineConfigs: TimelineConfigsType;
  setCustomTimelineConfigs: (value: TimelineConfigsType) => void;
  timelines: TimelineDefinitionsType;
  language: LanguageType;
  setLanguage: (language: LanguageType) => void;
  setCreateTimelineModalOpen: (open: boolean) => void;
  setEditingCustomAITimelineId: (id: string | null) => void;
}) {
  const {
    egoHandle,
    timelineId,
    setTimelineId,
    customTimelineConfigs,
    setCustomTimelineConfigs,
    timelines,
    language,
    setLanguage,
    setCreateTimelineModalOpen,
    setEditingCustomAITimelineId,
  } = props;

  return (
    <>
      <div
        className={
          "fixed flex flex-row items-center bg-white border-b-2 w-full z-20" +
          BORDER_300
        }
      >
        <Link
          href="/"
          className="text-xl font-light flex flex-row items-center h-16 p-4 px-3 mx-1 hover:bg-black/10 dark:hover:bg-white/10"
        >
          <Image
            src={"/skyline-64.png"}
            height={64}
            width={64}
            alt="Skyline Logo"
            className="h-8 w-8"
          />
          {/* spells skyline.gay in pride flag colors */}
          <span className="hidden sm:inline text-red-500 ml-3">s</span>
          <span className="hidden sm:inline text-orange-500">k</span>
          <span className="hidden sm:inline text-yellow-500">y</span>
          <span className="hidden sm:inline text-green-500">l</span>
          <span className="hidden sm:inline text-blue-500">i</span>
          <span className="hidden sm:inline text-purple-500">n</span>
          <span className="hidden sm:inline text-pink-500">e</span>
        </Link>
        <div className={"flex-1 border-l border-r my-4 " + BORDER_200}>
          {timelines && (
            <TimelinePicker
              timelineId={timelineId}
              setTimelineId={setTimelineId}
              customTimelineConfigs={customTimelineConfigs}
              setCustomTimelineConfigs={setCustomTimelineConfigs}
              egoHandle={egoHandle}
              timelines={timelines}
              language={language}
              setLanguage={setLanguage}
              setCreateTimelineModalOpen={setCreateTimelineModalOpen}
              setEditingCustomAITimelineId={setEditingCustomAITimelineId}
            />
          )}
        </div>
        <div className="px-1 h-16 flex flex-row">
          <Link
            href={"/messages"}
            className="w-14 h-16 hover:bg-black/10 dark:hover:bg-white/10 text-slate-800 flex justify-center items-center material-icons-outlined text-3xl"
          >
            email
          </Link>
          <Link
            href={"/profile/" + egoHandle}
            className="w-14 h-16 hover:bg-black/10 text-slate-800 flex justify-center items-center material-icons-outlined text-3xl"
          >
            person
          </Link>
        </div>
      </div>
      <div className="pb-20"></div>
    </>
  );
}
