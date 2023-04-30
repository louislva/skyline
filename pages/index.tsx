import Modal from "@/components/Modal";
import Timeline from "@/components/Timeline";
import { LoginResponseDataType } from "@/helpers/bsky";
import { LanguageType } from "@/helpers/classifyLanguage";
import {
  TimelineConfigsType,
  TimelineDefinitionType,
} from "@/helpers/makeFeeds";
import { TimelineDefinitionsType, TimelineIdType } from "@/helpers/timelines";
import { BskyAgent } from "@atproto/api";
import { useEffect, useState } from "react";

export const INPUT_CLASSNAME =
  "border outline-none dark:bg-slate-700 bg-slate-100 border-slate-300 dark:border-slate-700";

// TIMELINE SCREEN
export type TimelineScreenProps = {
  egoHandle: string;
  agent: BskyAgent;
  customTimelineConfigs: TimelineConfigsType;
  language: LanguageType;
  timelineId: TimelineIdType;
  timelines: TimelineDefinitionsType;
};
export default function TimelineScreen(props: TimelineScreenProps) {
  const {
    egoHandle,
    agent,
    customTimelineConfigs,
    language,
    timelineId,
    timelines,
  } = props;

  return (
    <Timeline
      key={
        timelineId +
        "--" +
        language +
        "--" +
        (customTimelineConfigs[timelineId]?.meta?.modifiedOn || "0")
      }
      timelineId={timelineId}
      agent={agent}
      egoHandle={egoHandle}
      timelines={timelines}
    />
  );
}
