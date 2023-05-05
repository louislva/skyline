import { ProduceFeedOutput } from "@/helpers/makeFeeds";
import { BORDER_300 } from "@/helpers/styling";
import { TimelineDefinitionsType, TimelineIdType } from "@/helpers/timelines";
import { BskyAgent } from "@atproto/api";
import { useEffect, useMemo, useRef, useState } from "react";
import LoadingSpinner, { LoadingPlaceholder } from "./LoadingSpinner";
import Post from "./Post";

export default function Timeline(props: {
  agent: BskyAgent;
  egoHandle: string;
  timelineId: TimelineIdType;
  timelines: TimelineDefinitionsType;
}) {
  const { agent, egoHandle, timelineId, timelines } = props;

  const [loadedSegments, setLoadedSegments] = useState<
    (ProduceFeedOutput & {
      loadTimestamp: number;
    })[]
  >([]);
  // const [posts, setPosts] = useState<SkylinePostType[]>([]);
  const posts = useMemo(
    () => loadedSegments.flatMap((segment) => segment.posts),
    [loadedSegments]
  );
  const cursor = loadedSegments.slice(-1)?.[0]?.cursor;
  const [loading, setLoading] = useState<boolean>(false);

  const loadSegment = async (direction: "down" | "up" = "down") => {
    timelines[timelineId]
      .produceFeed({
        agent,
        egoHandle,
        cursor: direction === "down" ? cursor : undefined,
      })
      .then(async (result) => {
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
        timelines[timelineId].postProcessFeed(
          {
            agent,
            egoHandle,
            posts: postsSliced,
          },
          (postsMerged) => {
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
    setLoadedSegments([]);
    setLoading(true);

    loadSegment();
  }, [timelineId]);

  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000 * 10);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={
        "border-2 w-full sm:w-136 bg-white dark:bg-slate-800 rounded-xl mb-8 overflow-hidden " +
        BORDER_300
      }
    >
      {posts.length > 0 ? (
        <>
          {now - loadedSegments?.[0]?.loadTimestamp > 60000 ? (
            <button
              className={
                "w-full h-12 dark:bg-slate-700 bg-slate-100 text-base flex flex-row items-center justify-center unselectable outline-none " +
                (loading
                  ? "dark:text-slate-300 text-slate-500"
                  : "dark:text-slate-50 text-slate-800")
              }
              onClick={() => {
                if (!loading) {
                  setLoading(true);
                  loadSegment("up");
                }
              }}
            >
              {loading ? (
                <LoadingSpinner
                  containerClassName="w-6 h-6 mr-2"
                  dotClassName="bg-slate-800 dark:bg-slate-400"
                />
              ) : (
                <span className="material-icons text-2xl mr-2">
                  arrow_upward
                </span>
              )}
              Refresh feed
            </button>
          ) : null}
          {posts.map((post, index) => (
            <Post
              agent={agent}
              key={post.postView.cid + "index" + index}
              post={post}
              isLastPostInFeed={index === posts.length - 1}
            />
          ))}
          <LoadMoreButton
            loadMore={() => {
              setLoading(true);
              loadSegment();
            }}
            loading={loading}
          />
        </>
      ) : loading ? (
        <LoadingPlaceholder />
      ) : (
        <div className="flex flex-col justify-center items-center py-32 text-slate-800 dark:text-slate-400">
          <div className="material-icons text-4xl mb-2">
            sentiment_dissatisfied
          </div>
          <div className="text-2xl">No posts in your timeline</div>
          <div className="text-lg mt-2 text-center">
            Try following some more accounts! We wholeheartedly recommend:{" "}
            <a
              href="https://staging.bsky.app/profile/louis02x.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 dark:text-blue-400"
            >
              @louis02x.com
            </a>{" "}
            (it's me lol)
          </div>
        </div>
      )}
    </div>
  );
}

export function LoadMoreButton(props: {
  loadMore: () => void;
  loading: boolean;
}) {
  const { loadMore, loading } = props;

  const buttonRef = useRef<HTMLButtonElement>(null);

  const lastLoadRef = useRef<number>(Date.now());
  const loadingRef = useRef<boolean>(false);
  loadingRef.current = loading;

  // const onWindowChange = () => {
  //   if (buttonRef.current) {
  //     let top = null;
  //     let bottom = null;

  //     top = buttonRef.current.getBoundingClientRect().top;
  //     bottom = buttonRef.current.getBoundingClientRect().bottom;

  //     const windowHeight = window.innerHeight;
  //     if (top !== null && bottom !== null) {
  //       if (
  //         top < windowHeight - 8 &&
  //         !loadingRef.current &&
  //         Date.now() - lastLoadRef.current > 20000
  //       ) {
  //         loadMore();
  //         lastLoadRef.current = Date.now();
  //       }
  //     }
  //   }
  // };
  // useEffect(() => {
  //   if (typeof window !== undefined) {
  //     window.addEventListener("resize", onWindowChange);
  //     window.addEventListener("scroll", onWindowChange);

  //     return () => {
  //       window.removeEventListener("resize", onWindowChange);
  //       window.removeEventListener("scroll", onWindowChange);
  //     };
  //   }
  // }, []);

  return (
    <button
      className={
        "w-full h-16 dark:bg-slate-700 bg-slate-100 text-base flex flex-row items-center justify-center unselectable outline-none " +
        (loading
          ? "dark:text-slate-300 text-slate-500"
          : "dark:text-slate-50 text-slate-800")
      }
      onClick={() => {
        if (!loading) {
          lastLoadRef.current = Date.now();
          loadMore();
        }
      }}
      ref={buttonRef}
    >
      {loading ? (
        <LoadingSpinner
          containerClassName="w-6 h-6 mr-2"
          dotClassName="bg-slate-800 dark:bg-slate-400"
        />
      ) : (
        <span className="material-icons text-2xl mr-2">add</span>
      )}
      Load more
    </button>
  );
}
