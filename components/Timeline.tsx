import { ProduceFeedOutput } from "@/helpers/makeFeeds";
import { TimelineDefinitionsType, TimelineIdType } from "@/helpers/timelines";
import { BskyAgent } from "@atproto/api";
import { useEffect, useMemo, useState } from "react";
import LoadingSpinner from "./LoadingSpinner";
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
    <div className="border-2 w-full sm:w-136 border-gray-300 bg-white dark:bg-slate-800 dark:border-slate-700 rounded-xl mb-8 overflow-hidden">
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
              isLastPost={index === posts.length - 1}
            />
          ))}
          <button
            className={
              "w-full h-16 dark:bg-slate-700 bg-slate-100 text-base flex flex-row items-center justify-center unselectable outline-none " +
              (loading
                ? "dark:text-slate-300 text-slate-500"
                : "dark:text-slate-50 text-slate-800")
            }
            onClick={() => {
              if (!loading) {
                setLoading(true);
                loadSegment();
              }
            }}
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
        </>
      ) : loading ? (
        <div className="flex flex-row justify-center items-center text-3xl py-32">
          <LoadingSpinner
            containerClassName="w-12 h-12 mr-4"
            dotClassName="bg-slate-800 dark:bg-slate-400"
          />
          <div className="text-slate-800 dark:text-slate-400">Loading...</div>
        </div>
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
