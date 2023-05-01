import { BskyAgent } from "@atproto/api";
import { FeedViewPost } from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import { feedViewPostToSkylinePost } from "./bsky";
import { ProduceFeedOutput } from "./makeFeeds";

type ListFeedState = {
  [key: string]: { feed: FeedViewPost[]; cursor: string | undefined };
};

interface LoopStep {
  shouldStop: boolean;
  newPosts: FeedViewPost[];
  newCursor: string;
}

export default class ListFetcher {
  /*
  WARNING: STATEFUL

  Fetches N_FETCH posts for each user in handlesList,
  identifies the user and timestamp of the oldest post,
  and fetches posts from everybody else until they're backfilled
  to that timestamp.

  To use with a 'load more' button, pass the already-loaded state
  into the constructor.

  TODO: return cursor value and shape? Is that necessary at all?
  */

  constructor(
    private agent: BskyAgent,
    private handlesList: string[],
    private state: ListFeedState = {}
  ) {
    if (state) {
      this.state = structuredClone(state);
    }
  }

  N_FETCH = 1;
  MAX_LOOPS = 15;

  call = async (): Promise<ProduceFeedOutput & { raw: ListFeedState }> => {
    if (Object.keys(this.state).length === 0) {
      // no user data
      await Promise.all(
        this.handlesList.map(async (handle) => {
          const fetched = await this.fetchForHandle(handle, this.N_FETCH);
          // TODO error handling and all that jazz
          if (fetched) {
            this.state[handle] = fetched;
          }
        })
      );
    }

    await this.backfill();
    const sorted = this.sortedAndFormattedPosts();
    return { posts: sorted, cursor: undefined, raw: this.state };
    // TODO return a useful cursor and maybe the user it's for too
    // (unless cursors aren't user-specific idk)
  };

  sortedAndFormattedPosts = () =>
    Object.values(this.state)
      .map((x) => x.feed)
      .flat()
      .sort((a: FeedViewPost, b: FeedViewPost) => {
        const dateA = new Date((a.post.record as any).createdAt);
        const dateB = new Date((b.post.record as any).createdAt);
        return dateB.getTime() - dateA.getTime();
      })
      .map(feedViewPostToSkylinePost);

  getDateFromPost = (post: FeedViewPost): Date =>
    new Date((post.post.record as any).createdAt);

  getOldestTimestamp = () => {
    let oldestTimestamp = new Date();
    this.handlesList.forEach((handle) => {
      const postList = this.state[handle].feed;
      if (postList.length === 0) return;
      const dateToCheck = this.getDateFromPost(postList.at(-1)!);
      if (dateToCheck.getTime() < oldestTimestamp.getTime()) {
        oldestTimestamp = dateToCheck;
      }
    });
    return oldestTimestamp;
  };

  fetchForHandle = (handle: string, limit: number, cursor?: string) =>
    this.agent
      .getAuthorFeed({
        actor: handle,
        limit,
        cursor,
      })
      .then((response) => {
        if (response.success) {
          return { feed: response.data.feed, cursor: response.data.cursor };
        }
        // TODO error handling and all that jazz
      });

  getHandlesNeedingMorePosts = (oldestTs: Date) => {
    const out: string[] = [];
    Object.entries(this.state).forEach(([handle, vals]) => {
      if (
        this.getDateFromPost(vals.feed.at(-1)!).getTime() > oldestTs.getTime()
      ) {
        out.push(handle);
      }
    });
    return out;
  };

  backfill = async () => {
    const oldestTs = this.getOldestTimestamp();
    let handlesToFetch = this.getHandlesNeedingMorePosts(oldestTs);
    let loopCount = 0;
    while (handlesToFetch.length > 0) {
      loopCount++;
      let handlesToStop: string[] = [];
      await Promise.all(
        this.handlesList.map(async (handle) => {
          const loopStep = await this.getMorePosts(handle, oldestTs);
          this.state[handle].feed.push(...loopStep.newPosts);
          this.state[handle].cursor = loopStep.newCursor;
          if (loopStep.shouldStop === true) {
            handlesToStop.push(handle);
          }
        })
      );
      handlesToFetch = handlesToFetch.filter(
        (handle) => !handlesToStop.includes(handle)
      );
      if (loopCount < this.MAX_LOOPS) break;
    }
  };

  getMorePosts = async (handle: string, oldestTs: Date): Promise<LoopStep> => {
    const output: LoopStep = { shouldStop: false, newPosts: [], newCursor: "" };
    const morePosts = await this.fetchForHandle(
      handle,
      15,
      this.state[handle].cursor
    );
    if (morePosts) {
      output.newPosts = morePosts.feed;
      output.newCursor = morePosts.cursor!;
      if (
        this.getDateFromPost(morePosts.feed.at(-1)!).getTime() <
        oldestTs.getTime()
      ) {
        // TODO another place an API error will bone us
        output.shouldStop = true;
      }
    }
    return output;
  };
}

new ListFetcher(12 as any, [], {});
