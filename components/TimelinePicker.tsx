import { LanguageType } from "@/helpers/classifyLanguage";
import { TimelineConfigType, TimelineConfigsType } from "@/helpers/makeFeeds";
import { TimelineDefinitionsType, TimelineIdType } from "@/helpers/timelines";
import { useEffect, useState } from "react";

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
  const [hoveredTimelineId, setHoveredTimelineId] =
    useState<TimelineIdType | null>(null);

  return (
    <div className="flex flex-col items-center mb-4">
      <div className="flex flex-col lg:flex-row items-center">
        <div className="flex flex-col lg:flex-row justify-start rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 overflow-hidden">
          {Object.keys(timelines).map((id, index) => {
            const isSelected = id === timelineId;

            return (
              <button
                key={id}
                className={`outline-none p-2 h-10 flex flex-row items-center border-slate-300 dark:border-slate-600 ${
                  id === timelineId
                    ? "bg-blue-500 dark:bg-slate-600 text-slate-50 "
                    : ""
                } ${index !== 0 ? "lg:border-l " : ""}`}
                onClick={() => {
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
          className="p-2 flex flex-row items-center justify-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md ml-0 lg:ml-2 mt-2 lg:mt-0 lg:w-8 h-8 px-2 lg:px-0 outline-none"
          onClick={() => {
            setCreateTimelineModalOpen(true);
          }}
        >
          <span className="material-icons mr">add</span>
          <span className="inline lg:hidden pl-1">Custom Timeline</span>
        </button>
      </div>

      <div className="max-w-xl text-sm text-slate-800 dark:text-slate-400 mt-2 text-center">
        <b>{timelines[hoveredTimelineId || timelineId].name}:</b>{" "}
        {timelines[hoveredTimelineId || timelineId].description}
      </div>
      {(!hoveredTimelineId || hoveredTimelineId === timelineId) && (
        <div className="flex flex-row justify-center items-center text-sm mt-2 gap-2">
          {timelineId === "whatsHot" && (
            <div className="max-w-xl text-sm text-slate-800 dark:text-slate-400 mt-0 text-center pr-2">
              {["english", "portuguese", "japanese", "farsi"].map(
                (lang, index) => (
                  <div
                    className={
                      "pl-2 ml-2 leading-none border-slate-300 dark:border-slate-600 inline-block " +
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
                navigator.clipboard.writeText(
                  `${window.location.origin}/?tl=${data.key}`
                );

                setLoading(false);
                setCopied(true);
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
      {copied ? (
        <>
          <span className="material-icons mr-1">content_copy</span>
          Copied link!
        </>
      ) : (
        <>
          <span className="material-icons mr-1">share</span>
          Share timeline prompt
        </>
      )}
    </button>
  );
}
