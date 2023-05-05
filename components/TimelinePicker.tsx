import { LanguageType } from "@/helpers/classifyLanguage";
import { TimelineConfigType, TimelineConfigsType } from "@/helpers/makeFeeds";
import { BORDER_200, BORDER_300 } from "@/helpers/styling";
import { TimelineDefinitionsType, TimelineIdType } from "@/helpers/timelines";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
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
    // TODO: reintroduce language setting
    language,
    setLanguage,
  } = props;
  const router = useRouter();
  const [hoveredTimelineId, setHoveredTimelineId] =
    useState<TimelineIdType | null>(null);

  const isShowingTimelines = ["", "/"].includes(router.pathname);

  const [dropdown, setDropdown] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && dropdown) {
      const func = (e: any) => {
        if (!e.target.closest("#timelinePickerButton")) {
          setDropdown(false);
        }
      };
      window.addEventListener("click", func);
      return () => {
        window.removeEventListener("click", func);
      };
    }
  }, [dropdown]);

  return (
    <div
      className="flex-1 flex flex-col items-stretch px-3"
      style={{
        maxWidth: 80 / 4 + "rem",
      }}
    >
      <div className="flex flex-row gap-1 items-center">
        <button
          id="timelinePickerButton"
          className={`flex-1 rounded-md border overflow-hidden outline-none p-2 h-8 flex flex-row items-center ${BORDER_300}`}
          onClick={() => {
            if (!isShowingTimelines) {
              router.push({
                pathname: "/",
              });
            } else {
              setDropdown(!dropdown);
            }
          }}
        >
          <span className="material-icons mr-2">
            {timelines[timelineId].icon}
          </span>
          <span className="text-sm xs:text-base flex-1 text-left">
            {timelines[timelineId].name}
          </span>
          <span className="material-icons ml-2">
            {/* dropdown */}
            expand_more
          </span>
        </button>
        {!!customTimelineConfigs[timelineId] && (
          <>
            <div className=""></div>
            <ShareTimelineButton
              key={timelineId}
              timelineConfig={customTimelineConfigs[timelineId]}
              egoHandle={egoHandle}
            />
            <button
              className="h-6 w-6 border rounded flex flex-row items-center justify-center dark:bg-yellow-700 dark:border-yellow-600 dark:text-yellow-100 bg-yellow-300 border-yellow-400 outline-none"
              onClick={() => {
                setEditingCustomAITimelineId(timelineId);
              }}
            >
              <span className="material-icons">edit</span>
            </button>
          </>
        )}
      </div>
      <div className="relative h-0">
        {dropdown && (
          <div
            className={
              "w-full absolute mt-1 flex flex-col justify-start rounded-md bg-white dark:bg-slate-800 border overflow-hidden" +
              BORDER_300
            }
          >
            {Object.keys(timelines).map((id, index) => {
              const isSelected = isShowingTimelines && id === timelineId;

              return (
                <button
                  key={id}
                  className={`outline-none p-2 h-8 flex flex-row items-center border-b ${BORDER_200} ${
                    isSelected
                      ? "bg-blue-500 dark:bg-slate-600 text-slate-50 "
                      : "hover:bg-black/10 dark:hover:bg-white/10"
                  }`}
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
                  <span className="text-sm xs:text-base">
                    {timelines[id].name}
                  </span>
                </button>
              );
            })}
            <button
              className={
                "outline-none p-2 h-8 flex flex-row items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 " +
                BORDER_200
              }
              onClick={() => {
                setCreateTimelineModalOpen(true);
              }}
            >
              <span className="material-icons mr-2">add</span>
              <span className="text-sm xs:text-base">Create timeline</span>
            </button>
          </div>
        )}
      </div>
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

  const inputRef = useRef<HTMLInputElement | null>(null);

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
                ref={inputRef}
                onClick={() => {
                  inputRef.current?.setSelectionRange(0, shareLink.length);
                }}
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
          "h-6 w-6 border rounded flex flex-row items-center justify-center dark:bg-green-700 dark:border-green-600 dark:text-green-100 bg-green-300 border-green-400 outline-none " +
          (loading ? "opacity-60 cursor-default" : "")
        }
        onClick={async () => {
          if (loading) return;
          setLoading(true);
          await fetch("/api/shared_custom_timeline", {
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
        <span className="material-icons">share</span>
      </button>
    </>
  );
}
