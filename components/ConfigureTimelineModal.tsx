import Modal from "@/components/Modal";
import {
  DEFAULT_BEHAVIOUR,
  TimelineConfigType,
  TimelineConfigsType,
  getDefaultTimelineConfig,
} from "@/helpers/makeFeeds";
import { behaviourToDescription } from "@/helpers/timelines";
import { BORDER_300, INPUT_CLASSNAME } from "@/helpers/styling";
import { useRef, useState } from "react";

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

function PromptsList(props: {
  placeholder: string | string[];
  prompts: string[];
  setPrompts: (prompts: string[]) => void;
}) {
  const { placeholder, prompts, setPrompts } = props;
  const inputsRefs = useRef<(HTMLInputElement | null)[]>([]);

  return (
    <>
      {prompts.map((prompt, index) => (
        <div className="flex flex-row items-center" key={index}>
          <input
            type="text"
            placeholder={
              typeof placeholder === "string"
                ? placeholder
                : placeholder[index % placeholder.length]
            }
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
            ref={(input) => {
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
  customTimelineConfigs: TimelineConfigsType;
  setCustomTimelineConfigs: (value: TimelineConfigsType) => void;
  close: () => void;
  editingCustomAITimelineId: string | null;
  setTimelineId: (id: string) => void;
}) {
  const {
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
            <PromptsList
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
                  };
                  delete newCustomTimelineConfigs[editingCustomAITimelineId];
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
