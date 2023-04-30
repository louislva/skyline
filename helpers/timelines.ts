import { LanguageType } from "@/helpers/classifyLanguage";
import { useLocalStorageState } from "@/helpers/hooks";
import {
  TimelineConfigType,
  TimelineConfigsType,
  TimelineDefinitionType,
  makePrincipledFeed,
} from "@/helpers/makeFeeds";

// TYPES
export type TimelineIdType = string;
export type TimelineDefinitionsType = {
  [id: TimelineIdType]: TimelineDefinitionType;
};

// HELPERS
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

export function useTimelines(language: LanguageType): {
  customTimelineConfigs: TimelineConfigsType;
  setCustomTimelineConfigs: (configs: TimelineConfigsType) => void;
  timelineDefinitions: TimelineDefinitionsType;
} {
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

  return {
    customTimelineConfigs,
    setCustomTimelineConfigs,
    timelineDefinitions,
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
export function behaviourToDescription(
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
