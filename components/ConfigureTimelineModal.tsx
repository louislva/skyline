import Modal from "@/components/Modal";
import {
  DEFAULT_BEHAVIOUR,
  TimelineConfigType,
  TimelineConfigsType,
  TimelineConfigsUnfilteredType,
  getDefaultTimelineConfig,
} from "@/helpers/makeFeeds";
import { BORDER_300, INPUT_CLASSNAME } from "@/helpers/styling";
import { behaviourToDescription } from "@/helpers/timelines";
import { BskyAgent } from "@atproto/api";
import { forwardRef, useEffect, useRef, useState } from "react";

function HorizontalSelector<T>(props: {
  value: T;
  setValue: (value: T) => void;
  options: [string, T][];
}) {
  const { value, setValue, options } = props;

  return (
    <div
      className={
        "flex flex-row h-10 rounded-md overflow-hidden border " + BORDER_300
      }
    >
      {options.map(([label, id], index) => {
        const selected = id === value;
        return (
          <button
            key={label + "|" + JSON.stringify(id)}
            className={
              "outline-none p-2 grow shrink text-center flex flex-row justify-center items-center " +
              BORDER_300 +
              (index !== 0 ? "border-l " : "") +
              (selected
                ? "dark:bg-slate-600 bg-slate-200"
                : "dark:bg-slate-700 bg-slate-100")
            }
            onClick={() => setValue(id)}
          >
            {label === "List" ? (
              <>
                <div className="ml-1 mr-1">{label}</div>
                <div className="text-xs px-1 text-white/90 rounded bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
                  BETA
                </div>
              </>
            ) : (
              <span>{label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const InputWithUserHandleSuggestions = forwardRef(
  (
    props: React.HTMLProps<HTMLInputElement> & {
      onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
      suggestUserHandles?: boolean;
      agent?: BskyAgent;
      value: string;
    },
    ref
  ) => {
    const { agent, suggestUserHandles } = props;
    const [value, setValue] = useState<string>(props.value);
    const [sugggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestionSelectIndex, setSuggestionSelectIndex] = useState(-1);
    const [suggestionHasBeenAccepted, setSuggestionHasBeenAccepted] =
      useState(false);
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
      if (sugggestions.length === 1) setSuggestionSelectIndex(0);
      else setSuggestionSelectIndex(-1);
    }, [sugggestions]);

    useEffect(() => {
      const timeout = setTimeout(async () => {
        if (
          agent &&
          suggestUserHandles &&
          !suggestionHasBeenAccepted &&
          isFocused
        ) {
          const term = value.startsWith("@") ? value.slice(1) : value;

          const response = await agent.app.bsky.actor.searchActorsTypeahead({
            limit: 5,
            term,
          });
          if (response.success) {
            const handles = response.data.actors
              .map((item) => item.handle)
              .filter((suggestion) => suggestion.startsWith(term));
            setSuggestions(handles);
            setShowSuggestions(handles.length > 0);
          }
        }
      }, 80);

      return () => clearTimeout(timeout);
    }, [
      props.value,
      agent,
      suggestUserHandles,
      suggestionHasBeenAccepted,
      isFocused,
    ]);

    useEffect(() => {
      setSuggestionHasBeenAccepted(false);
    }, [value]);

    const applySuggestion = (index: number) => {
      props.onChange?.({
        target: {
          value: "@" + sugggestions[index],
        },
      } as any);
      setShowSuggestions(false);
      setSuggestionHasBeenAccepted(true);
    };

    return (
      <div className="flex-1 relative">
        <input
          {...props}
          ref={ref as any}
          onChange={async (e) => {
            props.onChange?.(e);
            setValue(e.target.value);
          }}
          onBlur={() => {
            setIsFocused(false);
            setShowSuggestions(false);
          }}
          onFocus={() => {
            setIsFocused(true);
          }}
          onKeyDown={(e) => {
            if (sugggestions.length > 0 && showSuggestions) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSuggestionSelectIndex(
                  (suggestionSelectIndex + 1) % sugggestions.length
                );
                return;
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSuggestionSelectIndex(
                  suggestionSelectIndex === 0
                    ? sugggestions.length - 1
                    : suggestionSelectIndex - 1
                );
                return;
              } else if (e.key === "Enter") {
                e.preventDefault();
                applySuggestion(suggestionSelectIndex);
                return;
              }
            }
            props.onKeyDown?.(e as any);
          }}
        />
        {showSuggestions && (
          <div
            className={
              "absolute w-full z-20 rounded-md -mt-2 border-2 " +
              INPUT_CLASSNAME
            }
          >
            {sugggestions.map((userHandle, index) => (
              <button
                key={userHandle}
                className={
                  "w-full h-8 " +
                  (suggestionSelectIndex === index
                    ? "bg-black/10 dark:bg-white/10"
                    : "")
                }
                onMouseEnter={() => setSuggestionSelectIndex(index)}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  applySuggestion(index);
                }}
              >
                {userHandle}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);

function InputsList(props: {
  placeholder: string | string[];
  prompts: string[];
  setPrompts: (prompts: string[]) => void;

  agent?: BskyAgent;
  suggestUserHandles?: boolean;
}) {
  const { placeholder, prompts, setPrompts, agent, suggestUserHandles } = props;
  const inputsRefs = useRef<(HTMLInputElement | null)[]>([]);

  return (
    <>
      {prompts.map((prompt, index) => (
        <div className="flex flex-row items-center" key={index}>
          <InputWithUserHandleSuggestions
            agent={agent}
            suggestUserHandles
            type="text"
            placeholder={
              typeof placeholder === "string"
                ? placeholder
                : placeholder[index % placeholder.length]
            }
            className={"h-10 w-full rounded-md p-2 " + INPUT_CLASSNAME}
            value={prompt}
            onChange={(e) => {
              setPrompts(
                prompts
                  .slice(0, index)
                  // @ts-ignore
                  .concat([e.target.value])
                  .concat(prompts.slice(index + 1))
              );
            }}
            ref={(input) => {
              // @ts-ignore
              inputsRefs.current[index] = input;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPrompts([...prompts, ""]);
                setTimeout(() => {
                  inputsRefs.current[index + 1]?.focus();
                }, 50);
              }
              if (e.key === "Backspace" && prompt === "") {
                if (index !== 0) {
                  setPrompts(
                    prompts.slice(0, index).concat(prompts.slice(index + 1))
                  );
                  setTimeout(() => {
                    inputsRefs.current[index - 1]?.focus();
                  }, 50);
                }
              }
              if (
                e.key === "Delete" &&
                prompt === "" &&
                index < prompts.length - 1
              ) {
                setPrompts(
                  prompts.slice(0, index).concat(prompts.slice(index + 1))
                );
              }
            }}
          />
          {index === prompts.length - 1 ? (
            <button
              tabIndex={-1}
              className="h-8 w-8 ml-2 rounded-md bg-green-500 material-icons text-xl text-black unselectable"
              onClick={() => setPrompts([...prompts, ""])}
            >
              add
            </button>
          ) : (
            <button
              tabIndex={-1}
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
export default function ConfigureTimelineModal(props: {
  agent: BskyAgent;
  customTimelineConfigs: TimelineConfigsType;
  setCustomTimelineConfigs: (value: TimelineConfigsUnfilteredType) => void;
  close: () => void;
  editingCustomAITimelineId: string | null;
  setTimelineId: (id: string) => void;
}) {
  const {
    agent,
    customTimelineConfigs,
    setCustomTimelineConfigs,
    close,
    editingCustomAITimelineId,
    setTimelineId,
  } = props;
  const [config, setConfig] = useState<TimelineConfigType>(
    editingCustomAITimelineId
      ? customTimelineConfigs[editingCustomAITimelineId]
      : getDefaultTimelineConfig()
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
        <HorizontalSelector<
          "following" | "mutuals" | "popular" | "popular-nsfw" | "list"
        >
          value={
            config.behaviour.mutualsOnly
              ? "mutuals"
              : config.behaviour.baseFeed === "popular-nsfw"
              ? "popular"
              : (config.behaviour.baseFeed as "following" | "popular" | "list")
          }
          setValue={(value) => {
            setConfig({
              ...config,
              behaviour: {
                ...config.behaviour,
                baseFeed:
                  value === "mutuals"
                    ? "following"
                    : value === "popular" &&
                      config.behaviour.baseFeed === "popular-nsfw"
                    ? "popular-nsfw"
                    : value,
                mutualsOnly: value === "mutuals",
              },
            });
          }}
          options={[
            ["Following", "following"],
            ["Mutuals", "mutuals"],
            ["What's Hot", "popular"],
            ["List", "list"],
          ]}
        />
        {config.behaviour.baseFeed === "list" && (
          <>
            <label className="flex flex-row items-center mt-0">
              List members
            </label>
            <InputsList
              agent={agent}
              suggestUserHandles
              placeholder={[
                "@thearchduke.bsky.social",
                "@louis02x.com",
                "@woof.bsky.social",
              ]}
              prompts={
                config.behaviour.list?.length ? config.behaviour.list : [""]
              }
              setPrompts={(value) =>
                setConfig({
                  ...config,
                  behaviour: {
                    ...config.behaviour,
                    list: value,
                  },
                })
              }
            />
          </>
        )}
        {["popular-nsfw", "popular"].includes(
          config.behaviour.baseFeed || ""
        ) ? (
          <HorizontalSelector<"popular" | "popular-nsfw">
            key="whatshotselector"
            value={config.behaviour.baseFeed as "popular-nsfw" | "popular"}
            setValue={(value) => {
              setConfig({
                ...config,
                behaviour: {
                  ...config.behaviour,
                  baseFeed: value,
                },
              });
            }}
            options={[
              ["Safe-mode", "popular"],
              ["Unfiltered", "popular-nsfw"],
            ]}
          />
        ) : (
          <HorizontalSelector<"all" | "none">
            key="repliesselector"
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
        )}
        <label className="flex flex-row items-center mt-2">
          I want to see more of...
          <span className="material-icons text-green-600 ml-1">thumb_up</span>
        </label>
        <InputsList
          placeholder="Wholesome tweets, kindness, love, fun banter"
          prompts={positivePrompts}
          setPrompts={setPositivePrompts}
        />
        <label className="flex flex-row items-center mt-2">
          I want to see less of...
          <span className="material-icons text-red-600 ml-1">thumb_down</span>
        </label>
        <InputsList
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
        <div className="flex flex-row justify-between mt-4">
          {!!editingCustomAITimelineId && (
            <button
              className="bg-red-500 text-white rounded-md p-2 w-1/3 outline-none flex flex-row items-center justify-center"
              // className="h-6 px-1 border rounded flex flex-row items-center justify-center dark:bg-red-700 dark:border-red-600 dark:text-red-100 bg-red-300 border-red-400 outline-none"
              onClick={() => {
                // are you sure alert?
                if (
                  confirm(
                    `Are you sure you want to delete "${customTimelineConfigs[editingCustomAITimelineId].identity.name}"?`
                  )
                ) {
                  const newCustomTimelineConfigs = {
                    ...customTimelineConfigs,
                    [editingCustomAITimelineId]: null,
                  };
                  setCustomTimelineConfigs(newCustomTimelineConfigs);
                  setTimelineId("following");
                  close();
                }
              }}
            >
              <span className="material-icons mr-1 text-xl">delete</span>
              Delete
            </button>
          )}
          <div />
          <button
            className="bg-blue-500 text-white rounded-md p-2 w-1/3 outline-none"
            onClick={() => {
              const filteredPositivePrompts = positivePrompts.filter(
                (item) => !!item.trim()
              );
              const filteredNegativePrompts = negativePrompts.filter(
                (item) => !!item.trim()
              );

              const behaviour = {
                ...config.behaviour,
                list: config.behaviour.list
                  ?.filter((item) => !!item.trim())
                  .map((item) => (item[0] === "@" ? item : "@" + item)),
                positivePrompts: filteredPositivePrompts.length
                  ? filteredPositivePrompts
                  : undefined,
                negativePrompts: filteredNegativePrompts.length
                  ? filteredNegativePrompts
                  : undefined,
              };

              const newId = Date.now().toString();
              setCustomTimelineConfigs({
                ...customTimelineConfigs,
                [editingCustomAITimelineId || newId]: {
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
              // If it was just created, switch to it.
              if (!editingCustomAITimelineId) setTimelineId(newId);
              close();
            }}
          >
            {editingCustomAITimelineId ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
