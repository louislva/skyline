import Modal from "@/components/Modal";
import Timeline from "@/components/Timeline";
import { LoginResponseDataType } from "@/helpers/bsky";
import { LanguageType } from "@/helpers/classifyLanguage";
import { useLocalStorageState } from "@/helpers/hooks";
import {
  DEFAULT_BEHAVIOUR,
  TimelineConfigType,
  TimelineDefinitionType,
  makePrincipledFeed,
} from "@/helpers/makeFeeds";
import { BskyAgent } from "@atproto/api";
import * as jwt from "jsonwebtoken";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";

const INPUT_CLASSNAME =
  "border outline-none dark:bg-slate-700 bg-slate-100 border-slate-300 dark:border-slate-700";

// TIMELINES
export type TimelineIdType = string;
export type TimelineDefinitionsType = {
  [id: TimelineIdType]: TimelineDefinitionType;
};
type CustomAITimelineType = {
  name: string;
  positivePrompt: string;
  negativePrompt: string;
  sharedBy?: string;
};
type CustomAITimelinesType = {
  [id: TimelineIdType]: CustomAITimelineType;
};
type TimelineConfigsType = {
  [id: string]: TimelineConfigType;
};

// TIMELINE SCREEN
function TimelineScreen(props: {
  setLoginResponseData: (value: LoginResponseDataType | null) => void;
  egoHandle: string;
  agent: BskyAgent;
  timelineDefinitions: {
    [id: string]: TimelineDefinitionType;
  };
  customTimelineConfigs: TimelineConfigsType;
  setCustomTimelineConfigs: (value: TimelineConfigsType) => void;
  language: LanguageType;
  setLanguage: (value: LanguageType) => void;
}) {
  const {
    setLoginResponseData,
    egoHandle,
    agent,
    timelineDefinitions,
    customTimelineConfigs,
    setCustomTimelineConfigs,
    language,
    setLanguage,
  } = props;

  const timelines = useMemo(() => {
    return timelineDefinitions;
  }, [timelineDefinitions]);

  const [timelineId_, setTimelineId] = useLocalStorageState<TimelineIdType>(
    "@timelineId",
    "following"
  );
  // fallback if your localStorage stored timelineId doesn't exist any more
  const timelineId = timelines[timelineId_] ? timelineId_ : "following";

  const [createTimelineModal, setCreateTimelineModalOpen] = useState(false);
  const [editingCustomAITimelineId, setEditingCustomAITimelineId] = useState<
    string | null
  >(null);

  return (
    <div className="w-full flex flex-col items-center px-2">
      <Header logout={() => setLoginResponseData(null)} />
      <TimelinePicker
        timelineId={timelineId}
        setTimelineId={setTimelineId}
        egoHandle={egoHandle}
        timelines={timelines}
        setCreateTimelineModalOpen={setCreateTimelineModalOpen}
        setEditingCustomAITimelineId={setEditingCustomAITimelineId}
        customTimelineConfigs={customTimelineConfigs}
        setCustomTimelineConfigs={setCustomTimelineConfigs}
        language={language}
        setLanguage={setLanguage}
      />
      <Timeline
        key={timelineId + "--" + language}
        timelineId={timelineId}
        agent={agent}
        egoHandle={egoHandle}
        timelines={timelines}
      />
      <TweetComposer agent={agent} />
      {(createTimelineModal || editingCustomAITimelineId) && (
        <ConfigureTimelineModal
          customTimelineConfigs={customTimelineConfigs}
          setCustomTimelineConfigs={setCustomTimelineConfigs}
          close={() => {
            setCreateTimelineModalOpen(false);
            setEditingCustomAITimelineId(null);
          }}
          editingCustomAITimelineId={editingCustomAITimelineId}
        />
      )}
    </div>
  );
}
function TweetComposer(props: { agent: BskyAgent }) {
  const { agent } = props;

  const [isComposerOpen, setIsComposerOpen] = useState<boolean>(false);
  const [draft, setDraft] = useState<string>("");
  const charactersLeft = 300 - draft.length;
  const postDisabled = !(charactersLeft >= 0 && draft.trim().length > 0);

  useEffect(() => {
    setDraft("");
  }, [isComposerOpen]);

  const submit = async () => {
    await agent.post({
      text: draft,
    });
    setIsComposerOpen(false);
  };

  return (
    <>
      <button
        className="fixed bottom-0 right-0 m-6 w-16 h-16 rounded-full flex items-center justify-center text-slate-50 bg-blue-500 border-2 border-blue-500 shadow-lg material-icons text-3xl unselectable outline-none"
        onClick={() => setIsComposerOpen(true)}
      >
        edit_note
      </button>
      {isComposerOpen && (
        <Modal
          close={() => {
            setIsComposerOpen(false);
          }}
        >
          <div className="flex flex-row justify-between items-center pb-3">
            <button
              className="material-icons text-2xl bg-transparent"
              onClick={() => setIsComposerOpen(false)}
            >
              close
            </button>
            <button
              disabled={postDisabled}
              className={
                "px-4 py-2 rounded-sm " +
                (!postDisabled
                  ? "text-white bg-blue-600 dark:bg-blue-700"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300")
              }
              onClick={async () => {
                if (!postDisabled) {
                  submit();
                }
              }}
            >
              Post
            </button>
          </div>
          {/* Q: what's better: textarea or a ContentEditable with a placeholder? */}
          {/* A: textarea, because it supports multiple lines */}
          <textarea
            className={
              "w-full h-48 outline-none text-md p-4 outline-none rounded-md resize-none " +
              INPUT_CLASSNAME
            }
            autoFocus
            // since these are tweets: yes autocorrect, no autocapitalize
            autoCorrect="on"
            autoCapitalize="none"
            placeholder="What's happening?"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            // cmd / ctrl enter
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                if (!postDisabled) {
                  submit();
                }
              }
            }}
          ></textarea>
          {/* /300 counter */}
          <div className="flex flex-row justify-end pt-3 pr-3 pb-1">
            <span
              className={
                "text-base " +
                (charactersLeft < 0
                  ? "text-red-400"
                  : charactersLeft < 20
                  ? "text-yellow-400"
                  : "")
              }
            >
              {charactersLeft}
            </span>
          </div>
        </Modal>
      )}
    </>
  );
}
function Header(props: { logout?: () => void }) {
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
    <>
      <div className="w-full flex flex-row items-center justify-center">
        <div className="sm:flex-1"></div>
        <div className="flex flex-col items-start sm:items-center py-4">
          <div className="text-xl font-light">
            {/* spells skyline.gay in pride flag colors */}
            <span className="text-red-500">s</span>
            <span className="text-orange-500">k</span>
            <span className="text-yellow-500">y</span>
            <span className="text-green-500">l</span>
            <span className="text-blue-500">i</span>
            <span className="text-purple-500">n</span>
            <span className="text-pink-500">e</span>
          </div>
          <div className="text-sm font-light text-slate-900 dark:text-slate-300">
            {subheader}
          </div>
        </div>
        <div className="flex-1 flex flex-row justify-end items-center">
          {logout && (
            <button
              className="text-base border py-2 px-4 rounded-lg flex flex-row items-center ml-4 mr-0 sm:mr-3 text-slate-800 bg-white border-slate-300 dark:text-slate-50 dark:bg-slate-800 dark:border-slate-700 outline-none"
              onClick={() => logout()}
            >
              <span className="material-icons mr-2">logout</span>
              Logout
            </button>
          )}
        </div>
      </div>
    </>
  );
}
function TimelinePicker(props: {
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

function PromptsList(props: {
  placeholder: string;
  prompts: string[];
  setPrompts: (prompts: string[]) => void;
}) {
  const { placeholder, prompts, setPrompts } = props;
  return (
    <>
      {prompts.map((prompt, index) => (
        <div className="flex flex-row items-center">
          <input
            type="text"
            placeholder={placeholder}
            className={"h-10 flex-1 rounded-md p-2 " + INPUT_CLASSNAME}
            value={prompt}
            onChange={(e) => {
              setPrompts(
                prompts
                  .slice(0, index)
                  .concat([e.target.value])
                  .concat(prompts.slice(index + 1))
              );
            }}
          />
          {index === prompts.length - 1 ? (
            <button
              className="h-8 w-8 ml-2 rounded-md bg-green-500 material-icons text-xl text-black unselectable"
              onClick={() => setPrompts([...prompts, ""])}
            >
              add
            </button>
          ) : (
            <button
              className="h-8 w-8 ml-2 rounded-md bg-red-500 material-icons text-xl text-black unselectable"
              onClick={() => {
                setPrompts(
                  prompts.slice(0, index).concat(prompts.slice(index + 1))
                );
              }}
            >
              remove
            </button>
          )}
        </div>
      ))}
    </>
  );
}
function HorizontalSelector<T>(props: {
  value: T;
  setValue: (value: T) => void;
  options: [string, T][];
}) {
  const { value, setValue, options } = props;

  return (
    <div className="flex flex-row h-10 rounded-md overflow-hidden border border-slate-300 dark:border-slate-600">
      {options.map(([label, id], index) => {
        const selected = id === value;
        return (
          <button
            className={
              "outline-none p-2 flex-1 text-center border-slate-300 dark:border-slate-600 " +
              (index !== 0 ? "border-l " : "") +
              (selected
                ? "dark:bg-slate-600 bg-slate-200"
                : "dark:bg-slate-700 bg-slate-100")
            }
            onClick={() => setValue(id)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
function ConfigureTimelineModal(props: {
  customTimelineConfigs: TimelineConfigsType;
  setCustomTimelineConfigs: (value: TimelineConfigsType) => void;
  close: () => void;
  editingCustomAITimelineId: string | null;
}) {
  const {
    customTimelineConfigs,
    setCustomTimelineConfigs,
    close,
    editingCustomAITimelineId,
  } = props;
  const [config, setConfig] = useState<TimelineConfigType>(
    editingCustomAITimelineId
      ? customTimelineConfigs[editingCustomAITimelineId]
      : {
          meta: {
            origin: "self",
            createdOn: Date.now(),
            modifiedOn: Date.now(),
          },
          identity: {
            name: "",
            description: "",
            icon: "bolt",
          },
          behaviour: {
            baseFeed: "following",
            mutualsOnly: false,
            negativePrompts: [],
            positivePrompts: [],
            replies: "all",
            sorting: "combo",
          },
        }
  );

  const [positivePrompts, setPositivePrompts] = useState<string[]>(
    config.behaviour.positivePrompts?.length
      ? config.behaviour.positivePrompts
      : [""]
  );
  const [negativePrompts, setNegativePrompts] = useState<string[]>(
    config.behaviour.negativePrompts?.length
      ? config.behaviour.negativePrompts
      : [""]
  );

  return (
    <Modal close={close}>
      <div className="text-xl font-bold mb-4">
        {editingCustomAITimelineId
          ? `Edit "${config?.identity?.name}" timeline`
          : "Create a timeline"}
      </div>
      <div className="flex flex-col gap-2">
        <label>Title</label>
        <input
          type="text"
          placeholder="Wholesome TL"
          className={"rounded-md p-2 w-1/2 " + INPUT_CLASSNAME}
          value={config.identity.name}
          onChange={(e) =>
            setConfig({
              ...config,
              identity: { ...config.identity, name: e.target.value },
            })
          }
        />
        <label className="mt-2">Base feed</label>
        <HorizontalSelector<"following" | "mutuals" | "popular">
          value={
            config.behaviour.mutualsOnly
              ? "mutuals"
              : (config.behaviour.baseFeed as "following" | "popular")
          }
          setValue={(value) => {
            setConfig({
              ...config,
              behaviour: {
                ...config.behaviour,
                baseFeed: value === "mutuals" ? "following" : value,
                mutualsOnly: value === "mutuals",
              },
            });
          }}
          options={[
            ["Following", "following"],
            ["Mutuals", "mutuals"],
            ["What's Hot", "popular"],
          ]}
        />
        <HorizontalSelector<"all" | "none">
          value={config.behaviour.replies || "all"}
          setValue={(value) =>
            setConfig({
              ...config,
              behaviour: { ...config.behaviour, replies: value },
            })
          }
          options={[
            ["Show replies", "all"],
            ["Hide replies", "none"],
          ]}
        />
        <label className="flex flex-row items-center mt-2">
          I want to see more of...
          <span className="material-icons text-green-600 ml-1">thumb_up</span>
        </label>
        <PromptsList
          placeholder="Wholesome tweets, kindness, love, fun banter"
          prompts={positivePrompts}
          setPrompts={setPositivePrompts}
        />
        <label className="flex flex-row items-center mt-2">
          I want to see less of...
          <span className="material-icons text-red-600 ml-1">thumb_down</span>
        </label>
        <PromptsList
          placeholder="Angry tweets, like tweets with politics, dating discourse, dunks"
          prompts={negativePrompts}
          setPrompts={setNegativePrompts}
        />
        <label className="mt-2">
          Sorting
          <p className="dark:text-slate-400">
            The AI will assign a match % from -100% to +100% to each post.
            Everything less than 0% will be removed. Choose how to sort the
            remaining posts.
          </p>
        </label>
        <HorizontalSelector<TimelineConfigType["behaviour"]["sorting"]>
          value={config.behaviour.sorting}
          setValue={(value) =>
            setConfig({
              ...config,
              behaviour: { ...config.behaviour, sorting: value },
            })
          }
          options={[
            ["Latest", "time"],
            ["Best match %", "score"],
            ["Combo", "combo"],
          ]}
        />
        <button
          className="bg-blue-500 text-white rounded-md p-2 w-1/3 mt-4 ml-auto outline-none"
          onClick={() => {
            const filteredPositivePrompts = positivePrompts.filter(
              (item) => !!item.trim()
            );
            const filteredNegativePrompts = negativePrompts.filter(
              (item) => !!item.trim()
            );

            const behaviour = {
              ...config.behaviour,
              positivePrompts: filteredPositivePrompts.length
                ? filteredPositivePrompts
                : undefined,
              negativePrompts: filteredNegativePrompts.length
                ? filteredNegativePrompts
                : undefined,
            };

            setCustomTimelineConfigs({
              ...customTimelineConfigs,
              [editingCustomAITimelineId || Date.now().toString()]: {
                meta: {
                  ...config.meta,
                  modifiedOn: Date.now(),
                },
                identity: {
                  ...config.identity,
                  name: config.identity.name.trim(),
                  description: behaviourToDescription({
                    ...DEFAULT_BEHAVIOUR,
                    ...behaviour,
                  }),
                },
                behaviour,
              },
            });
            close();
          }}
        >
          {editingCustomAITimelineId ? "Save" : "Create"}
        </button>
      </div>
    </Modal>
  );
}

// LOGIN SCREEN
function LoginScreen(props: {
  setLoginResponseData: (data: LoginResponseDataType | null) => void;
  agent: BskyAgent;
}) {
  const { setLoginResponseData, agent } = props;
  const login = (username: string, password: string) => {
    setError(null);
    agent
      .login({
        identifier: username,
        password: password,
      })
      .then((response) => {
        if (response.success) {
          setLoginResponseData({
            ...response.data,
          });
        } else {
          // Error
          setLoginResponseData(null);
          setError("Error");
        }
      })
      .catch((err) => {
        // Error
        setLoginResponseData(null);
        setError(err.message);
      });
  };

  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<null | string>(null);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-2">
      <Header />
      {/* An offset equal to the security info (ish) */}
      <div className="h-32" />
      {/* The title */}
      <h1 className="text-3xl font-bold mb-6">Login to Bluesky</h1>
      {/* The login form */}
      <form
        className="flex flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          login(username.replace("@", ""), password);
        }}
      >
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={"p-2 rounded mb-4 " + INPUT_CLASSNAME}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={"p-2 rounded mb-4 " + INPUT_CLASSNAME}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white p-2 rounded outline-none"
        >
          Login
        </button>
      </form>
      {error && <p className="text-red-500 mt-4">{error}</p>}
      {/* Security policy section */}
      <SecurityInfo />
    </div>
  );
}
function SecurityInfo() {
  return (
    <div className="mt-32 max-w-sm bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-300 dark:border-slate-600 rounded-xl mb-8">
      <div className="flex flex-row pb-2 border-b border-slate-300 dark:border-slate-600 mb-2">
        <span className="material-icons mr-2 cursor-pointer">info</span>
        <div>Is this secure?</div>
      </div>
      <b>Yes!</b> Bluesky unfortunately doesn't have an OAuth login system yet,
      but we've taken the following measures to make sure your data is safe:
      <ul className="list-disc list-inside">
        <li>
          We don't send your password to our own servers. Every request is made
          directly from <i>your</i> browser to Bluesky's servers.
        </li>
        <li>
          We don't store your password anywhere. Not on the backend, not on the
          frontend, not in cookies, nowhere.
        </li>
        <li>
          If you don't trust us, you can always check the source code of{" "}
          <a
            href="https://github.com/louislva/skyline"
            className="text-blue-500"
            target="_blank"
          >
            the service here.
          </a>
        </li>
      </ul>
    </div>
  );
}

// HELPERS
type RefreshJwtType = {
  exp: number;
  iat: number;
  jti: string; // long random key
  scope: string; // "com.atproto.refresh"
  sub: string; // did
};
type AccessJwtType = {
  exp: number;
  iat: number;
  scope: string;
  sub: string;
};
function convertOldCustomToNewConfig(
  config: CustomAITimelineType,
  id: string = ""
): TimelineConfigType {
  const { name, positivePrompt, negativePrompt, sharedBy } = config;
  const behaviour: TimelineConfigType["behaviour"] = {
    baseFeed: "following",
    mutualsOnly: false,
    positivePrompts: positivePrompt.trim() ? [positivePrompt] : undefined,
    negativePrompts: negativePrompt.trim() ? [negativePrompt] : undefined,
    sorting: "combo",
  };
  return {
    meta: {
      origin: sharedBy ? "shared" : "self",
      createdOn: !isNaN(parseInt(id)) ? parseInt(id) : Date.now(),
      modifiedOn: !isNaN(parseInt(id)) ? parseInt(id) : Date.now(),
      shared: sharedBy
        ? {
            createdByHandle: sharedBy,
          }
        : undefined,
    },
    identity: {
      name: name,
      // a material icon that symbolizes "custom"
      icon: sharedBy ? "public" : "bolt",
      description: behaviourToDescription({
        ...DEFAULT_BEHAVIOUR,
        ...behaviour,
      }),
    },
    behaviour,
  };
}
function promptsToDescription(positivePrompt: string, negativePrompt: string) {
  return positivePrompt.trim() && negativePrompt.trim()
    ? `, showing more "${positivePrompt.trim()}" and less "${negativePrompt.trim()}"`
    : negativePrompt.trim()
    ? `, filtering out "${negativePrompt.trim()}"`
    : positivePrompt.trim()
    ? `, showing more "${positivePrompt.trim()}"`
    : "";
}
function behaviourToDescription(
  behaviour: TimelineConfigType["behaviour"]
): string {
  const segmentBase = behaviour.mutualsOnly
    ? "Mutuals feed"
    : behaviour.baseFeed === "popular"
    ? "What's Hot feed"
    : "Following feed";
  const segmentReplies = behaviour.replies === "none" ? " without replies" : "";

  const positivePromptJoined = (behaviour.positivePrompts || []).join(" | ");
  const negativePromptJoined = (behaviour.negativePrompts || []).join(" | ");
  const segmentPrompt =
    positivePromptJoined.trim() && negativePromptJoined.trim()
      ? `, showing more "${positivePromptJoined.trim()}" and less "${negativePromptJoined.trim()}"`
      : negativePromptJoined.trim()
      ? `, filtering out "${negativePromptJoined.trim()}"`
      : positivePromptJoined.trim()
      ? `, showing more "${positivePromptJoined.trim()}"`
      : "";

  return segmentBase + segmentReplies + segmentPrompt;
}
function getDefaultTimelineConfigs(
  language: LanguageType
): TimelineConfigsType {
  return {
    following: {
      meta: {
        origin: "system",
      },
      identity: {
        icon: "person_add",
        name: "Following",
        description:
          "Posts from people you follow, in reverse chronological order",
      },
      behaviour: {
        baseFeed: "following",
        mutualsOnly: false,
        replies: "all",
        sorting: "time",
      },
    },
    whatsHot: {
      meta: {
        origin: "system",
      },
      identity: {
        icon: "trending_up",
        name: `What's Hot (${
          {
            english: "English",
            portuguese: "Português",
            farsi: "فارسی",
            japanese: "日本語",
          }[language]
        })`,
        description:
          "What's Hot feed, filtered to show only your preferred language",
      },
      behaviour: {
        baseFeed: "popular",
        mutualsOnly: false,
        replies: "all",
        language: language,
        sorting: "time",
      },
    },
    "one-from-each": {
      meta: {
        origin: "system",
      },
      identity: {
        icon: "casino",
        name: "One from each",
        description:
          "Latest post from each person you follow, randomly ordered. Useful for keeping up with everyone.",
      },
      behaviour: {
        baseFeed: "one-from-each",
        mutualsOnly: false,
        replies: "none",
      },
    },
    mutuals: {
      meta: {
        origin: "system",
      },
      identity: {
        icon: "people",
        name: "Mutuals",
        description: "Posts from your friends",
      },
      behaviour: {
        baseFeed: "following",
        mutualsOnly: true,
        replies: "all",
        sorting: "time",
      },
    },
    wholesome: {
      meta: {
        origin: "system",
      },
      identity: {
        icon: "favorite",
        name: "Wholesome",
        description:
          "AI-feed boosting wholesome tweets, and removing angry / political / culture war tweets",
      },
      behaviour: {
        baseFeed: "following",
        mutualsOnly: false,
        replies: "all",
        positivePrompts: ["Wholesome tweet, kindness, love, fun banter"],
        negativePrompts: [
          "Angry tweets, with politics, people talking about gender & dating, etc.",
        ],
        sorting: "combo",
      },
    },
  };
}

// SINGLE-USE HOOKS
function useMigrateOldCustomTimelines(
  customTimelineConfigs: TimelineConfigsType,
  setCustomTimelineConfigs: (configs: TimelineConfigsType) => void
) {
  // Migrate old custom timeline system to new system
  const [customAITimelines, setCustomAITimelines] =
    useLocalStorageState<CustomAITimelinesType>("@customAITimelines", {});
  useEffect(() => {
    if (Object.keys(customAITimelines).length > 0) {
      setCustomAITimelines({});
      setCustomTimelineConfigs({
        ...customTimelineConfigs,
        ...Object.fromEntries(
          Object.entries(customAITimelines).map(([id, config]) => {
            return [id, convertOldCustomToNewConfig(config)] as [
              TimelineIdType,
              TimelineConfigType
            ];
          })
        ),
      });
    }
  }, [customAITimelines]);
}
function useCustomTimelineInstaller(
  customTimelineConfigs: TimelineConfigsType,
  setCustomTimelineConfigs: (configs: TimelineConfigsType) => void
) {
  const router = useRouter();
  useEffect(() => {
    if (router.query.tl) {
      fetch(`/api/shared_custom_timeline?key=${router.query.tl}`).then(
        (res) => {
          if (res.ok) {
            res.json().then(
              (
                json:
                  | {
                      config: CustomAITimelineType;
                      config_new: null;
                    }
                  | {
                      config: null;
                      config_new: TimelineConfigType;
                    }
              ) => {
                router.replace("/", undefined, {
                  scroll: false,
                  shallow: true,
                });
                const config = json.config_new
                  ? json.config_new
                  : convertOldCustomToNewConfig(json.config);
                setCustomTimelineConfigs({
                  ...customTimelineConfigs,
                  [Date.now().toString()]: {
                    ...config,
                    identity: {
                      ...config.identity,
                      icon: "public",
                    },
                  },
                });
              }
            );
          } else {
            throw Error("Couldn't GET shared_ai_timeline: " + res.statusText);
          }
        }
      );
    }
  }, [router.query.tl]);
}
function useAuthorization(agent: BskyAgent) {
  const [loginResponseData, setLoginResponseData] =
    useLocalStorageState<LoginResponseDataType | null>(
      "@loginResponseData",
      null
    );

  const egoHandle = loginResponseData?.handle;
  const accessJwt = !!loginResponseData?.accessJwt
    ? (jwt.decode(loginResponseData.accessJwt) as AccessJwtType)
    : null;
  const loginExpiration = accessJwt?.exp;
  const timeUntilLoginExpire = loginExpiration
    ? loginExpiration * 1000 - Date.now()
    : null;
  useEffect(() => {
    if (timeUntilLoginExpire) {
      const timeout = setTimeout(() => {
        setLoginResponseData(null);
      }, Math.max(timeUntilLoginExpire, 0));

      return () => clearTimeout(timeout);
    }
  }, [timeUntilLoginExpire]);
  useEffect(() => {
    if (loginResponseData && !agent.session) {
      agent.resumeSession(loginResponseData);
    }
  }, [loginResponseData]);

  return { egoHandle, setLoginResponseData };
}

export default function Main() {
  // Bluesky API
  const agent = useRef<BskyAgent>(
    new BskyAgent({
      service: "https://bsky.social",
    })
  ).current;

  // Auth stuff
  const { egoHandle, setLoginResponseData } = useAuthorization(agent);

  // Styling for body
  useEffect(() => {
    const className = "bg-slate-50 dark:bg-slate-900";
    className.split(" ").forEach((name) => document.body.classList.add(name));

    return () => {
      className
        .split(" ")
        .forEach((name) => document.body.classList.remove(name));
    };
  }, []);

  // Build timelines
  const [language, setLanguage] = useLocalStorageState<LanguageType>(
    "@language",
    "english"
  );
  const defaultTimelineConfigs = getDefaultTimelineConfigs(language);
  const [customTimelineConfigs, setCustomTimelineConfigs] =
    useLocalStorageState<TimelineConfigsType>("@customTimelineConfigs", {});
  const timelineConfigs = {
    ...defaultTimelineConfigs,
    ...customTimelineConfigs,
  };
  const timelineDefinitions: {
    [id: TimelineIdType]: TimelineDefinitionType;
  } = Object.fromEntries(
    Object.entries(timelineConfigs).map(([key, config]) => {
      return [key, makePrincipledFeed(config["identity"], config["behaviour"])];
    })
  );

  // Makes sure to migrate timelines from @customAITimelines into @customTimelineConfigs (if any)
  useMigrateOldCustomTimelines(customTimelineConfigs, setCustomTimelineConfigs);

  // If ?tl=<key> in URL, install a new custom timeline.
  useCustomTimelineInstaller(customTimelineConfigs, setCustomTimelineConfigs);

  return (
    <>
      <Head>
        <title>Skyline</title>
        <link rel="icon" href="/skyline-16.png" />
      </Head>
      <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-900 dark:text-slate-100">
        {egoHandle ? (
          <TimelineScreen
            setLoginResponseData={setLoginResponseData}
            egoHandle={egoHandle}
            agent={agent}
            timelineDefinitions={timelineDefinitions}
            customTimelineConfigs={customTimelineConfigs}
            setCustomTimelineConfigs={setCustomTimelineConfigs}
            language={language}
            setLanguage={setLanguage}
          />
        ) : (
          <LoginScreen
            setLoginResponseData={setLoginResponseData}
            agent={agent}
          />
        )}
      </div>
    </>
  );
}
