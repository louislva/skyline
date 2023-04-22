import { BskyAgent } from "@atproto/api";
import { ProfileView } from "@atproto/api/dist/client/types/app/bsky/actor/defs";
import { ExpandedPostView, RecordType, SkylinePostType } from "./contentTypes";
import { ThreadViewPost } from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import { Response as GetPostThreadResponse } from "@atproto/api/dist/client/types/app/bsky/feed/getPostThread";
import Cache from "./cache";

let followsCache: ProfileView[] | null = null;
let followersCache: ProfileView[] | null = null;
let threadCache = new Cache<GetPostThreadResponse>("threadCache");

export async function getFollows(
  agent: BskyAgent,
  identifier: string,
  maxPages: number = 10
): Promise<ProfileView[]> {
  if (followsCache) return followsCache;

  let follows: ProfileView[] = [];
  let cursor;
  for (let i = 0; i < maxPages; i++) {
    const response = await agent.getFollows({
      actor: identifier,
      cursor,
    });

    if (response.success) {
      follows = follows.concat(response.data.follows);
      if (!response.data.cursor || response.data.follows.length === 0) {
        break;
      }
      cursor = response.data.cursor;
    } else {
      // TODO: Handle error
      break;
    }
  }
  followsCache = follows;
  return follows;
}
async function getFollowers(
  agent: BskyAgent,
  identifier: string,
  maxPages: number = 10
): Promise<ProfileView[]> {
  if (followersCache) return followersCache;
  let followers: ProfileView[] = [];
  let cursor;
  for (let i = 0; i < maxPages; i++) {
    const response = await agent.getFollowers({
      actor: identifier,
      cursor,
    });

    if (response.success) {
      followers = followers.concat(response.data.followers);
      if (!response.data.cursor || response.data.followers.length === 0) {
        break;
      }
      cursor = response.data.cursor;
    } else {
      // TODO: Handle error
      break;
    }
  }
  followersCache = followers;
  return followers;
}
export async function getMutuals(
  agent: BskyAgent,
  identifier: string
): Promise<ProfileView[]> {
  const followsPromise = getFollows(agent, identifier);
  const followersPromise = getFollowers(agent, identifier);
  const follows = await followsPromise;
  const followers = await followersPromise;

  const isDidAFollower = Object.fromEntries(
    followers.map((f) => [f.did, true])
  );

  const mutuals = follows.filter((f) => isDidAFollower[f.did]);
  return mutuals;
}
async function getThread(agent: BskyAgent, uri: string) {
  if (threadCache.get(uri)) return threadCache.get(uri)!;

  const response = await agent.getPostThread({
    uri,
  });
  if (response.success) threadCache.set(uri, response);
  return response;
}
export function getThreadCacheOnly(uri: string): GetPostThreadResponse | null {
  return threadCache.get(uri) || null;
}
export function unrollThread(response: GetPostThreadResponse) {
  let newPosts: SkylinePostType[] = [];
  try {
    if (response.success) {
      let node: ThreadViewPost | null = response.data.thread.post
        ? (response.data.thread as ThreadViewPost)
        : null;
      while (node) {
        newPosts.unshift({
          postView: node.post as ExpandedPostView,
        });
        node = node.parent?.post ? (node.parent as ThreadViewPost) : null;
      }
    }
  } catch (error) {
    console.error("Error unrolling thread");
  }

  return newPosts;
}
export async function mergeConversationsContinual(
  agent: BskyAgent,
  allPosts_: SkylinePostType[],
  callback: (posts: SkylinePostType[]) => void
) {
  let window = 5;

  const allPosts: SkylinePostType[] = JSON.parse(JSON.stringify(allPosts_));
  let newPosts = allPosts.slice();

  for (let i = 0; i < allPosts.length; i += window) {
    window *= 2;
    const posts = allPosts.slice(i, i + window);

    // First, load all the replies
    await Promise.all(
      posts.map(async (post) => {
        const record = post.postView.record as RecordType;
        if (record.reply) {
          // Make sure the parent post is in the list
          let newPosts: SkylinePostType[] = [];
          try {
            const response = await getThread(agent, record.reply.parent.uri);
            newPosts = unrollThread(response);
          } catch (error) {
            console.error("Error loading parent post");
          }
          post.replyingTo = newPosts;
        }

        return;
      })
    );

    // Then, remove all replyingTo posts from the root
    posts.forEach((post) => {
      post.replyingTo?.forEach((replyingToPost) => {
        newPosts = newPosts.filter(
          (p) => p.postView.cid !== replyingToPost.postView.cid
        );
      });
    });
    callback(newPosts);
  }
  callback(newPosts);
}

export type LoginResponseDataType = {
  accessJwt: string;
  did: string;
  email?: string;
  handle: string;
  refreshJwt: string;
};
