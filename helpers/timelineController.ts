import { BskyAgent } from "@atproto/api";
import {
  TimelineDefinitionsType,
  TimelineIdType,
  getDefaultTimelineConfigs,
} from "./timelines";
import {
  ProduceFeedOutput,
  TimelineConfigsType,
  getDefaultTimelineConfig,
} from "./makeFeeds";
import { useEffect, useMemo, useRef, useState } from "react";

export function useTimelineController(
  agent: BskyAgent,
  egoHandle: string | undefined,
  timelineDefinitions: TimelineDefinitionsType,
  customTimelineConfigs: TimelineConfigsType,
  timelineId: TimelineIdType
) {
  const [loadedSegments, setLoadedSegments] = useState<
    (ProduceFeedOutput & {
      loadTimestamp: number;
    })[]
  >([]);
  const posts = useMemo(
    () => loadedSegments.flatMap((segment) => segment.posts),
    [loadedSegments]
  );
  const cursorRef = useRef<any>();
  cursorRef.current = loadedSegments.slice(-1)?.[0]?.cursor;

  const [loading, setLoading] = useState<boolean>(false);

  const timelineDefinition = timelineDefinitions[timelineId];
  const timelineConfig =
    customTimelineConfigs[timelineId] ||
    getDefaultTimelineConfigs("english")[timelineId] ||
    null;

  const loadIdRef = useRef<number>(0);

  const loadSegment = async (direction: "down" | "up" = "down") => {
    if (!egoHandle) return;
    const myLoadId = loadIdRef.current;
    timelineDefinition
      .produceFeed({
        agent,
        egoHandle,
        cursor: direction === "down" ? cursorRef.current : undefined,
      })
      .then(async (result) => {
        if (loadIdRef.current !== myLoadId) return;
        const loadTimestamp = Date.now();
        if (direction === "up") {
          setLoadedSegments((oldLoadedSegments) => [
            {
              loadTimestamp,
              posts: [],
              cursor: result.cursor,
            },
            ...oldLoadedSegments,
          ]);
        } else {
          setLoadedSegments((oldLoadedSegments) => [
            ...oldLoadedSegments,
            {
              loadTimestamp,
              posts: [],
              cursor: result.cursor,
            },
          ]);
        }

        const postsSliced = result.posts;
        timelineDefinition.postProcessFeed(
          {
            agent,
            egoHandle,
            posts: postsSliced,
          },
          (postsMerged) => {
            if (loadIdRef.current !== myLoadId) return;
            setLoadedSegments((oldLoadedSegments) => {
              const olderPostCids = oldLoadedSegments
                .filter(
                  (oldLoadedSegment) =>
                    oldLoadedSegment.loadTimestamp !== loadTimestamp
                )
                .flatMap((oldLoadedSegment) =>
                  oldLoadedSegment.posts.map((post) => post.postView.cid)
                );

              const postsMergedAndDeduplicated = postsMerged.filter(
                (post) => !olderPostCids.includes(post.postView.cid)
              );

              return oldLoadedSegments.map((oldLoadedSegment, index) =>
                oldLoadedSegment.loadTimestamp === loadTimestamp
                  ? {
                      ...oldLoadedSegment,
                      posts: postsMergedAndDeduplicated,
                    }
                  : oldLoadedSegment
              );
            });
            setLoading(false);
          }
        );
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadIdRef.current++;
    if (egoHandle) {
      setLoadedSegments([]);
      setLoading(true);

      loadSegment();
    }
  }, [egoHandle, timelineId]);

  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000 * 10);
    return () => clearInterval(interval);
  }, []);

  return { posts, now, loadedSegments, setLoading, loadSegment, loading };
}
export type TimelineControllerReturnType = ReturnType<
  typeof useTimelineController
>;
