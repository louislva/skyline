import { LoadMoreButton } from "@/components/LoadMoreButton";
import LoadingSpinner, {
  LoadingPlaceholder,
} from "@/components/LoadingSpinner";
import Post from "@/components/Post";
import { BORDER_300 } from "@/helpers/styling";
import { TimelineControllerReturnType } from "@/helpers/timelineController";
import { BskyAgent } from "@atproto/api";

// TIMELINE SCREEN
export type TimelineScreenProps = {
  agent: BskyAgent;
  timelineController: TimelineControllerReturnType;
};
export default function TimelineScreen(props: TimelineScreenProps) {
  const { agent, timelineController } = props;

  return <Timeline agent={agent} timelineController={timelineController} />;
}

function Timeline(props: {
  agent: BskyAgent;
  timelineController: TimelineControllerReturnType;
}) {
  const { agent, timelineController } = props;
  const { posts, now, loadedSegments, setLoading, loadSegment, loading } =
    timelineController;

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
