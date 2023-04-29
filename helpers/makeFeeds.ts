import { BskyAgent } from "@atproto/api";
import { ExpandedPostView, SkylinePostType } from "./contentTypes";
import { ProfileView } from "@atproto/api/dist/client/types/app/bsky/actor/defs";
import {
  getFollows,
  getMutuals,
  getThreadCacheOnly,
  mergeConversationsContinual,
  unrollThread,
} from "./bsky";
import { PostView } from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import classifyLanguage, { LanguageType } from "./classifyLanguage";
const cosineSimilarity = require("compute-cosine-similarity");

export type ProduceFeedOutput = {
  posts: SkylinePostType[];
  cursor: string | undefined;
};
export type TimelineDefinitionType = {
  icon: string;
  name: string;
  description: string;
  produceFeed: (params: {
    agent: BskyAgent;
    egoIdentifier: string;
    cursor: string | undefined;
  }) => Promise<ProduceFeedOutput>;
  postProcessFeed: (
    params: {
      agent: BskyAgent;
      egoIdentifier: string;
      posts: SkylinePostType[];
    },
    setPostsCallback: (posts: SkylinePostType[]) => void
  ) => void;
};

const defaultPostProcessFeed: TimelineDefinitionType["postProcessFeed"] = (
  { agent, egoIdentifier, posts },
  callback
) => {
  mergeConversationsContinual(agent, posts, (postsMerged) => {
    callback(postsMerged);
  });
};

export function makeOneFromEachFeed(): TimelineDefinitionType {
  return {
    icon: "casino",
    name: "One from each",
    description:
      "Latest post from each person you follow, randomly ordered. Useful for keeping up with everyone.",
    produceFeed: async ({ agent, egoIdentifier, cursor }) => {
      const follows = await getFollows(agent, egoIdentifier);

      let postsPerUser = await Promise.all(
        follows.map((follow) =>
          agent
            .getAuthorFeed({
              actor: follow.handle,
              cursor,
              limit: 9,
            })
            .then((response) => {
              if (response.success) {
                return response.data.feed
                  .filter((item) => !item.reason && !item.reply)
                  .map((item) => item.post);
              } else {
                return [];
              }
            })
        )
      );
      let epochs: PostView[][] = [];

      let run = true;
      while (run) {
        run = false;
        epochs.push([]);
        const epoch = epochs[epochs.length - 1];
        // Get the newest post from each user
        postsPerUser.forEach((userPosts) => {
          if (userPosts.length > 0) {
            epoch.push(userPosts.shift()!);
            run = true;
          }
        });
        // Shuffle the posts in the epoch
        epoch.sort(() => Math.random() - 0.5);
      }

      return {
        cursor: undefined,
        posts: epochs
          .slice(0, 3)
          .flat()
          .map((post) => ({ postView: post } as SkylinePostType)),
      };
    },
    postProcessFeed: defaultPostProcessFeed,
  };
}
function markdownQuote(text: string): string {
  return "> " + text.replace(/\n/g, "\n> ");
}

async function loadBaseFeed(
  baseFeed: "following" | "popular",
  agent: BskyAgent,
  cursor?: string | undefined
): Promise<ProduceFeedOutput> {
  const response =
    baseFeed === "following"
      ? await agent.getTimeline({
          cursor,
          limit: 100,
        })
      : await agent.api.app.bsky.unspecced.getPopular({
          cursor,
          limit: 100,
        });

  if (response.success) {
    const posts = response.data.feed.map((item) => ({
      postView: item.post as ExpandedPostView,
      repostBy:
        item.reason?.$type === "app.bsky.feed.defs#reasonRepost"
          ? (item.reason.by as ProfileView)
          : undefined,
    }));
    return {
      posts,
      cursor: response.data.cursor,
    };
  } else {
    throw new Error("Failed to get baseFeed (" + baseFeed + ")");
  }
}
function postsToText(posts: SkylinePostType[]): string[] {
  return posts.map((post) => {
    // Compile every post we can foresee will be rendered in the feed
    let thread: SkylinePostType[] = [];
    if (post.postView.record.reply?.parent?.uri) {
      const parent = getThreadCacheOnly(post.postView.record.reply.parent.uri);
      if (parent) {
        thread = unrollThread(parent);
      }
    }
    thread.push(post);
    // Technically we'll only render the first and last two, so maybe we should filter as such
    // Otoh, it's good to have the whole thread for context, when classifying it

    // Then, take them and put them into text-only format
    const textThread = thread
      .map((item, index) => {
        const introduction =
          index === 0
            ? `${post.postView.author.displayName} (@${post.postView.author.handle}) says:\n`
            : `${post.postView.author.displayName} (@${post.postView.author.handle}) replies:\n`;

        const text = "" + (item.postView.record.text || "").trim();
        // @ts-expect-error
        const quotePost = item.postView.embed?.record?.value?.text
          ? `Quote post from ${
              // @ts-expect-error
              item.postView.embed?.record?.author?.displayName
            } (@${
              // @ts-expect-error
              item.postView.embed?.record?.author?.handle
            }):\n` +
            markdownQuote(
              // @ts-expect-error
              item.postView.embed.record.value.text.trim()
            )
          : "";
        const image = !!item.postView.record.embed?.images?.length
          ? `[${item.postView.record.embed.images.length} ${
              item.postView.record.embed.images.length === 1
                ? "image"
                : "images"
            } attached]`
          : "";

        const components = [text, quotePost, image]
          .filter((component) => component)
          .join("\n\n");

        return introduction + markdownQuote(components);
      })
      .join("\n\n---\n\n");

    return textThread;
  });
}

function average(array: number[]): number {
  return array.reduce((a, b) => a + b, 0) / array.length;
}
function max(array: number[]): number {
  return array.reduce((a, b) => Math.max(a, b));
}

const DEFAULT_PROMPT = ["says"];
export function makePrincipledFeed(
  identity: {
    icon: string;
    name: string;
    description: string;
  },
  behaviour: {
    baseFeed?: "following" | "popular";
    mutualsOnly?: boolean;
    language?: LanguageType;
    replies?: "all" | "following" | "none";
    positivePrompts?: string[];
    negativePrompts?: string[];
    sorting?: "score" | "time" | "combo";
    minimumScore?: number;
  }
): TimelineDefinitionType {
  const {
    baseFeed = "following",
    mutualsOnly = false,
    language,
    positivePrompts,
    negativePrompts,
    replies = "all",
    sorting = "combo",
    minimumScore = 0,
  } = behaviour;

  const useLLM = positivePrompts?.length || negativePrompts?.length;

  return {
    ...identity,
    produceFeed: async ({ agent, egoIdentifier, cursor }) => {
      // 1. DATA LOADS
      // Load mutuals list asynchronously, if required
      let mutualsPromise: Promise<ProfileView[]> = Promise.resolve([]);
      if (mutualsOnly) mutualsPromise = getMutuals(agent, egoIdentifier);

      // Load base feed
      let { posts, cursor: newCursor } = await loadBaseFeed(
        baseFeed,
        agent,
        cursor
      );

      // Load LLM scoring
      let positivePromptEmbeddings: number[][] = [];
      let negativePromptEmbeddings: number[][] = [];
      if (useLLM) {
        const embeddingsResponse = await fetch("/api/embeddings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: postsToText(posts)
              .concat(positivePrompts || DEFAULT_PROMPT)
              .concat(negativePrompts || DEFAULT_PROMPT),
          }),
        });
        const embeddings: number[][] = await embeddingsResponse.json();

        posts = posts.map((post, index) => {
          return { ...post, embedding: embeddings[index] };
        }) as SkylinePostType[];
        positivePromptEmbeddings = embeddings.slice(
          posts.length,
          posts.length + (positivePrompts || DEFAULT_PROMPT).length
        );
        negativePromptEmbeddings = embeddings.slice(
          posts.length + (positivePrompts || DEFAULT_PROMPT).length,
          posts.length +
            (positivePrompts || DEFAULT_PROMPT).length +
            (negativePrompts || DEFAULT_PROMPT).length
        );
      }

      // 2. FILTERING
      // mutualsOnly
      if (mutualsOnly) {
        const mutuals = await mutualsPromise;
        const isMutualByDid = Object.fromEntries(
          mutuals.map((m) => [m.did, true])
        );
        posts = posts.filter((post) => isMutualByDid[post.postView.author.did]);
      }

      // replies
      if (replies === "following") {
        // TODO: this might need to be handled in defaultPostProcessFeed, since we don't yet know who the reply is to
      } else if (replies === "none") {
        posts = posts.filter((item) => !item.postView.record.reply);
      } else {
        // Do nothing
      }

      // language
      if (language) {
        posts = posts.filter(
          (item) => classifyLanguage(item.postView.record.text) === language
        );
      }

      // 3. SORTING
      if (useLLM) {
        // score by LLM embedding
        posts = posts.map((post) => {
          const positiveScore = max(
            positivePromptEmbeddings.map((e, i) =>
              cosineSimilarity(post.embedding, e)
            )
          );
          const negativeScore = max(
            negativePromptEmbeddings.map((e, i) =>
              cosineSimilarity(post.embedding, e)
            )
          );
          const score = positiveScore - negativeScore;

          return { ...post, score };
        });
        posts = posts.filter((post) => post.score! > minimumScore);
        if (sorting === "score") {
          posts.sort((a, b) => b.score! - a.score!);
        } else if (sorting === "combo") {
          posts.sort((a, b) => {
            const bAgo =
              Date.now() - new Date(b.postView.record.createdAt).getTime();
            const aAgo =
              Date.now() - new Date(a.postView.record.createdAt).getTime();
            // 0 = sort by time, 50 ~= sort by score, 5 ~= sort by combo
            const SCORE_SENSITIVITY = 5;
            return (
              aAgo / Math.pow(a.score!, SCORE_SENSITIVITY) -
              bAgo / Math.pow(b.score!, SCORE_SENSITIVITY)
            );
          });
        }
      }

      return {
        posts,
        cursor: newCursor,
      };
    },
    postProcessFeed: defaultPostProcessFeed,
  };
}
