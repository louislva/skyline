import { BskyAgent } from "@atproto/api";
import { FeedViewPost } from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import { feedViewPostToSkylinePost } from "./bsky";
import { ProduceFeedOutput } from "./makeFeeds";

const LIMIT = 10;

type ListFeedState = {
  handles: {
    [key: string]: {
      feed: FeedViewPost[];
      cursor: string | undefined;
      oldestPostLoaded: number;
    };
  };
  oldestPostDisplayed: number;
};

export default async function fetchList(
  agent: BskyAgent,
  listMembers: string[],
  restoreState?: ListFeedState | undefined
): Promise<ProduceFeedOutput> {
  let state = restoreState || {
    handles: {},
    oldestPostDisplayed: Date.now(),
  };

  const { oldestPostDisplayed } = state;

  await Promise.all(
    listMembers.map(async (authorHandle) => {
      const { feed, oldestPostLoaded, cursor } = state.handles[
        authorHandle
      ] || {
        feed: [],
        cursor: undefined,
        oldestPostLoaded: null,
      };
      if (
        oldestPostLoaded === null ||
        oldestPostLoaded >= oldestPostDisplayed
      ) {
        // if it's either NOT LOADED or all posts have been displayed already, load more posts.
        const authorFeed = await agent.getAuthorFeed({
          actor: authorHandle,
          limit: LIMIT,
          cursor,
        });
        if (authorFeed.success) {
          state.handles[authorHandle] = state.handles[authorHandle] || {
            feed: [],
            cursor: undefined,
            oldestPostLoaded: null,
          };
          state.handles[authorHandle].feed = feed.concat(authorFeed.data.feed);
          state.handles[authorHandle].cursor = authorFeed.data.cursor;
          state.handles[authorHandle].oldestPostLoaded =
            authorFeed.data.feed.length < LIMIT
              ? 0 // This means we've loaded their earliest post, so we'll set it to 0 to not block later loads.
              : Math.min(
                  ...state.handles[authorHandle].feed.map((post) =>
                    new Date(post.post.indexedAt).getTime()
                  )
                );
        }
      }
    })
  );

  // STEP 2: display every post between the previous oldestPostLoaded & the new oldestPostLoaded.
  const newestToReturn = oldestPostDisplayed;
  // Basically, "what is the first authorFeed that cuts off?"
  state.oldestPostDisplayed = Math.max(
    ...Object.values(state.handles).map((item) => item.oldestPostLoaded)
  );
  const oldestToReturn = state.oldestPostDisplayed;

  const resultFeed = Object.values(state.handles)
    .flatMap((item) => item.feed)
    .filter((post) => {
      const ts = new Date(post.post.indexedAt).getTime();
      return oldestToReturn <= ts && ts < newestToReturn;
    })
    // reverse chronological order (newest first)
    .sort(
      (a, b) =>
        new Date(b.post.indexedAt).getTime() -
        new Date(a.post.indexedAt).getTime()
    )
    .map(feedViewPostToSkylinePost);

  return {
    cursor: state,
    posts: resultFeed,
  };
}
