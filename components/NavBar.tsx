import { LanguageType } from "@/helpers/classifyLanguage";
import { TimelineConfigsType } from "@/helpers/makeFeeds";
import { BORDER_200, BORDER_300 } from "@/helpers/styling";
import { TimelineDefinitionsType, TimelineIdType } from "@/helpers/timelines";
import Image from "next/image";
import Link from "next/link";
import TimelinePicker from "./TimelinePicker";
import { useEffect, useState } from "react";
import { BskyAgent } from "@atproto/api";
import { useRouter } from "next/router";

export default function NavBar(props: {
  agent: BskyAgent;
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
  const router = useRouter();
  const {
    agent,
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

  const [notificationsCount, setNotificationsCount] = useState<number>(0);
  useEffect(() => {
    agent.app.bsky.notification
      .getUnreadCount()
      .then((result) => setNotificationsCount(result.data.count));
  });

  const egoProfileLink = "/profile/" + egoHandle;

  console.log(router.asPath);

  return (
    <>
      <div
        className={
          "fixed flex flex-row items-center bg-white dark:bg-slate-800 border-b-2 w-full z-20" +
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
          {/* <Link
            href={"/messages"}
            className="w-14 h-16 hover:bg-black/10 dark:hover:bg-white/10 flex justify-center items-center material-icons-outlined text-3xl"
          >
            email
          </Link> */}
          <Link
            href={"/notifications"}
            className={
              "w-14 h-16 hover:bg-black/10 dark:hover:bg-white/10 flex justify-center items-center text-3xl " +
              (router.asPath === "/notifications"
                ? "material-icons "
                : "material-icons-outlined ")
            }
          >
            notifications
            {!!notificationsCount && (
              <div
                className="-ml-4 -mt-5 h-5 font-sans font-bold bg-blue-600 text-white text-sm p-1 leading-none flex justify-center items-center rounded-full border border-transparent dark:border-slate-800 "
                style={{
                  minWidth: 5 / 4 + "rem",
                }}
              >
                {notificationsCount}
              </div>
            )}
          </Link>
          <Link
            href={egoProfileLink}
            className={
              "w-14 h-16 hover:bg-black/10 dark:hover:bg-white/10 flex justify-center items-center text-3xl " +
              (router.asPath == egoProfileLink
                ? "material-icons "
                : "material-icons-outlined ")
            }
          >
            person
          </Link>
        </div>
      </div>
      <div className="pb-20"></div>
    </>
  );
}
