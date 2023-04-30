import Modal from "@/components/Modal";
import {
  DEFAULT_BEHAVIOUR,
  TimelineConfigType,
  TimelineConfigsType,
} from "@/helpers/makeFeeds";
import { behaviourToDescription } from "@/helpers/timelines";
import { BORDER_300, INPUT_CLASSNAME } from "@/helpers/styling";
import { useState } from "react";

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
            className={
              "outline-none p-2 flex-1 text-center " +
              BORDER_300 +
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
export default function ConfigureTimelineModal(props: {
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
