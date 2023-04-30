import { useEffect } from "react";
import { useLocalStorageState } from "./hooks";
import {
  DEFAULT_BEHAVIOUR,
  TimelineConfigType,
  TimelineConfigsType,
} from "./makeFeeds";
import { TimelineIdType, behaviourToDescription } from "./timelines";

export type CustomAITimelineType = {
  name: string;
  positivePrompt: string;
  negativePrompt: string;
  sharedBy?: string;
};
export type CustomAITimelinesType = {
  [id: TimelineIdType]: CustomAITimelineType;
};

export function convertOldCustomToNewConfig(
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

export function useMigrateOldCustomTimelines(
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
