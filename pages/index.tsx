import Timeline from "@/components/Timeline";
import { LanguageType } from "@/helpers/classifyLanguage";
import { TimelineConfigsType } from "@/helpers/makeFeeds";
import { TimelineDefinitionsType, TimelineIdType } from "@/helpers/timelines";
import { BskyAgent } from "@atproto/api";

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
