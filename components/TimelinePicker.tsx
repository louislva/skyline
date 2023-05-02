import { LanguageType } from "@/helpers/classifyLanguage";
import { TimelineConfigType, TimelineConfigsType } from "@/helpers/makeFeeds";
import { BORDER_300 } from "@/helpers/styling";
import { TimelineDefinitionsType, TimelineIdType } from "@/helpers/timelines";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Modal from "./Modal";

export default function TimelinePicker(props: {
  timelineId: TimelineIdType;
  setTimelineId: (timelineId: TimelineIdType) => void;
  customTimelineConfigs: TimelineConfigsType;
  setCustomTimelineConfigs: (value: TimelineConfigsType) => void;
  egoHandle: string;
  timelines: TimelineDefinitionsType;
  language: LanguageType;
  setLanguage: (language: LanguageType) => void;
  setCreateTimelineModalOpen: (open: boolean) => void;
  setEditingCustomAITimelineId: (id: string | null) => void;
}) {
  const {
    timelineId,
    setTimelineId,
    customTimelineConfigs,
    setCustomTimelineConfigs,
    egoHandle,
    timelines,
    setCreateTimelineModalOpen,
    setEditingCustomAITimelineId,
    language,
    setLanguage,
  } = props;
  const router = useRouter();
  const [hoveredTimelineId, setHoveredTimelineId] =
    useState<TimelineIdType | null>(null);

  const isShowingTimelines = ["", "/"].includes(router.pathname);

  return (
    <div className="flex flex-col items-center mb-4">
      <div className="flex flex-col lg:flex-row items-center">
        <div
          className={
            "flex flex-col lg:flex-row justify-start rounded-md bg-white dark:bg-slate-800 border overflow-hidden" +
            BORDER_300
          }
        >
          {Object.keys(timelines).map((id, index) => {
            const isSelected = isShowingTimelines && id === timelineId;

            return (
              <button
                key={id}
                className={`outline-none p-2 h-10 flex flex-row items-center ${BORDER_300} ${
                  isSelected
                    ? "bg-blue-500 dark:bg-slate-600 text-slate-50 "
                    : ""
                } ${index !== 0 ? "lg:border-l " : ""}`}
                onClick={() => {
                  if (!isShowingTimelines) {
                    router.push({
                      pathname: "/",
                    });
                  }
                  setTimelineId(id as TimelineIdType);
                  setHoveredTimelineId(null);
                }}
                onMouseEnter={() => {
                  setHoveredTimelineId(id as TimelineIdType);
                }}
                onMouseMove={() => {
                  setHoveredTimelineId(id as TimelineIdType);
                }}
                onMouseLeave={() => {
                  setHoveredTimelineId(null);
                }}
              >
                <span className="material-icons mr-2">
                  {timelines[id].icon}
                </span>
                <span>{timelines[id].name}</span>
              </button>
            );
          })}
        </div>
        <button
          className={
            "p-2 flex flex-row items-center justify-center bg-white dark:bg-slate-800 border rounded-md ml-0 lg:ml-2 mt-2 lg:mt-0 lg:w-8 h-8 px-2 lg:px-0 outline-none " +
            BORDER_300
          }
          onClick={() => {
            setCreateTimelineModalOpen(true);
          }}
        >
          <span className="material-icons mr">add</span>
          <span className="inline lg:hidden pl-1">Custom Timeline</span>
        </button>
      </div>

      {(isShowingTimelines || hoveredTimelineId) && (
        <div className="max-w-xl text-sm text-slate-800 dark:text-slate-400 mt-2 text-center">
          <b>{timelines[hoveredTimelineId || timelineId].name}:</b>{" "}
          {timelines[hoveredTimelineId || timelineId].description}
        </div>
      )}
      {isShowingTimelines &&
        (!hoveredTimelineId || hoveredTimelineId === timelineId) && (
          <div className="flex flex-row justify-center items-center text-sm mt-2 gap-2">
            {timelineId === "whatsHot" && (
              <div className="max-w-xl text-sm text-slate-800 dark:text-slate-400 mt-0 text-center pr-2">
                {["english", "portuguese", "japanese", "farsi"].map(
                  (lang, index) => (
                    <div
                      className={
                        "pl-2 ml-2 leading-none inline-block " +
                        BORDER_300 +
                        (lang.toLowerCase() === language
                          ? "font-bold dark:font-normal dark:text-slate-50 underline"
                          : "") +
                        (index === 0 ? "" : " border-l")
                      }
                      key={index}
                      onClick={() => setLanguage(lang as LanguageType)}
                    >
                      {lang}
                    </div>
                  )
                )}
              </div>
            )}
            {!!customTimelineConfigs[timelineId] && (
              <>
                <ShareTimelineButton
                  key={timelineId}
                  timelineConfig={customTimelineConfigs[timelineId]}
                  egoHandle={egoHandle}
                />
                <button
                  className="h-6 px-1 border rounded flex flex-row items-center justify-center dark:bg-yellow-700 dark:border-yellow-600 dark:text-yellow-100 bg-yellow-300 border-yellow-400 outline-none"
                  onClick={() => {
                    setEditingCustomAITimelineId(timelineId);
                  }}
                >
                  <span className="material-icons mr-1">edit</span>
                  Edit
                </button>
                <button
                  className="h-6 px-1 border rounded flex flex-row items-center justify-center dark:bg-red-700 dark:border-red-600 dark:text-red-100 bg-red-300 border-red-400 outline-none"
                  onClick={() => {
                    // are you sure alert?
                    if (
                      confirm(
                        `Are you sure you want to delete "${customTimelineConfigs[timelineId].identity.name}"?`
                      )
                    ) {
                      const newCustomTimelineConfigs = {
                        ...customTimelineConfigs,
                      };
                      delete newCustomTimelineConfigs[timelineId];
                      setCustomTimelineConfigs(newCustomTimelineConfigs);
                      setTimelineId("following");
                    }
                  }}
                >
                  <span className="material-icons mr-1">delete</span>
                  Delete
                </button>
              </>
            )}
          </div>
        )}
    </div>
  );
}
function ShareTimelineButton(props: {
  timelineConfig: TimelineConfigType;
  egoHandle: string;
}) {
  const { timelineConfig, egoHandle } = props;
  const [loading, setLoading] = useState<boolean>(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => {
        setCopied(false);
      }, 2000);
      return () => {
        clearTimeout(timeout);
      };
    }
  }, [copied]);

  return (
    <>
      {shareLink && (
        <Modal
          close={() => {
            setShareLink(null);
          }}
        >
          <div className="flex flex-col p-3">
            <h3 className="text-lg mb-2">Here's your shared timeline link:</h3>
            <div className="p-2 rounded-md bg-slate-200 dark:bg-slate-700 flex flex-row">
              <input
                className="flex-1 text-black dark:text-slate-50 flex-1 bg-transparent outline-none"
                value={shareLink}
              />
              <button
                className="text-black dark:text-slate-50 flex flex-row items-center"
                onClick={() => {
                  navigator.clipboard.writeText(shareLink);
                  setCopied(true);
                }}
              >
                <span className="material-icons mx-1">file_copy</span>
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
          </div>
        </Modal>
      )}
      <button
        className={
          "h-6 px-1 border rounded flex flex-row items-center justify-center dark:bg-green-700 dark:border-green-600 dark:text-green-100 bg-green-300 border-green-400 outline-none " +
          (loading ? "opacity-60 cursor-default" : "")
        }
        onClick={async () => {
          if (loading) return;
          setLoading(true);
          const response = await fetch("/api/shared_custom_timeline", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              config_new: timelineConfig,
              created_by_handle: egoHandle,
            }),
          })
            .then((res) => {
              if (res.ok) {
                res.json().then((data) => {
                  // copy link to clipboard
                  setLoading(false);
                  setShareLink(`${window.location.origin}/?tl=${data.key}`);
                });
              } else {
                throw new Error(
                  "Couldn't POST shared_custom_timeline: " + res.status
                );
              }
            })
            .catch((error) => {
              setLoading(false);
              throw error;
            });
        }}
      >
        <span className="material-icons mr-1">share</span>
        Share timeline prompt
      </button>
    </>
  );
}
