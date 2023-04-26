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

export function makeSinglePersonFeed(handle: string): TimelineDefinitionType {
  return {
    icon: "toys",
    name: "Just @" + handle,
    description: "Posts from @" + handle,
    produceFeed: async ({ agent, cursor }) => {
      const response = await agent.getAuthorFeed({
        actor: handle,
        cursor,
      });
      if (response.success) {
        return {
          posts: response.data.feed
            .filter((item) => {
              return !!item.post;
            })
            .map((item) => {
              const repostBy: ProfileView | undefined =
                item.reason?.$type === "app.bsky.feed.defs#reasonRepost"
                  ? (item.reason.by as ProfileView)
                  : undefined;

              return {
                postView: item.post as ExpandedPostView,
                repostBy,
              };
            }),
          cursor: response.data.cursor,
        };
      } else {
        throw new Error("Failed to get timeline");
      }
    },
    postProcessFeed: defaultPostProcessFeed,
  };
}
export function makeBaseFeed(
  baseFeed: "following" | "popular" = "following"
): TimelineDefinitionType {
  return {
    icon: "person_add",
    name: "Following",
    description: "Posts from people you follow, in reverse chronological order",
    produceFeed: async ({ agent, cursor }) => {
      const response =
        baseFeed === "following"
          ? await agent.getTimeline({
              cursor,
            })
          : await agent.api.app.bsky.unspecced.getPopular({
              cursor,
            });
      if (response.success) {
        return {
          posts: response.data.feed.map((item) => ({
            postView: item.post as ExpandedPostView,
            repostBy:
              item.reason?.$type === "app.bsky.feed.defs#reasonRepost"
                ? (item.reason.by as ProfileView)
                : undefined,
          })),
          cursor: response.data.cursor,
        };
      } else {
        throw new Error("Failed to get timeline");
      }
    },
    postProcessFeed: defaultPostProcessFeed,
  };
}
export function makeLanguageFeed(
  baseFeed: "following" | "popular" = "following",
  preferredLanguage: LanguageType
): TimelineDefinitionType {
  return {
    icon: "person_add",
    name: "Language (" + preferredLanguage + ")",
    description: "Posts from What's Hot in your language",
    produceFeed: async ({ agent, cursor }) => {
      const response =
        baseFeed === "following"
          ? await agent.getTimeline({
              cursor,
            })
          : await agent.api.app.bsky.unspecced.getPopular({
              cursor,
            });
      if (response.success) {
        return {
          posts: response.data.feed
            .map((item) => ({
              postView: item.post as ExpandedPostView,
              repostBy:
                item.reason?.$type === "app.bsky.feed.defs#reasonRepost"
                  ? (item.reason.by as ProfileView)
                  : undefined,
            }))
            .filter((item) => {
              const text = item.postView.record.text;
              const language = classifyLanguage(text);

              return language === preferredLanguage;
            }),
          cursor: response.data.cursor,
        };
      } else {
        throw new Error("Failed to get timeline");
      }
    },
    postProcessFeed: defaultPostProcessFeed,
  };
}

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
export function makeMutualsFeed(): TimelineDefinitionType {
  return {
    icon: "people",
    name: "Mutuals",
    description: "Posts from your friends",
    produceFeed: async ({ agent, egoIdentifier, cursor }) => {
      const mutualsPromise = getMutuals(agent, egoIdentifier);
      const response = await agent.getTimeline({
        cursor,
      });
      const mutuals = await mutualsPromise;
      const isMutualByDid = Object.fromEntries(
        mutuals.map((m) => [m.did, true])
      );

      if (response.success) {
        return {
          posts: response.data.feed
            .map((item) => ({
              postView: item.post as ExpandedPostView,
              repostBy:
                item.reason?.$type === "app.bsky.feed.defs#reasonRepost"
                  ? (item.reason.by as ProfileView)
                  : undefined,
            }))
            .filter((item) => isMutualByDid[item.postView.author.did]),
          cursor: response.data.cursor,
        };
      } else {
        throw new Error("Failed to get timeline");
      }
    },
    postProcessFeed: defaultPostProcessFeed,
  };
}
function markdownQuote(text: string): string {
  return "> " + text.replace(/\n/g, "\n> ");
}
export function makeEmbeddingsFeed(
  positivePrompt: string | null,
  negativePrompt: string | null,
  baseFeed: "following" | "popular" = "following",
  sorting: "score" | "time" | "combo" = "combo",
  minimumScore: number = 0
): TimelineDefinitionType {
  return {
    icon: "trending_up",
    name: "AI feed",
    description: `Posts like "${positivePrompt}" and unlike "${negativePrompt}"`,
    produceFeed: async ({ agent, cursor }) => {
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

        const embeddingsResponse = await fetch("/api/embeddings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: posts
              .map((post) => {
                // Compile every post we can foresee will be rendered in the feed
                let thread: SkylinePostType[] = [];
                if (post.postView.record.reply?.parent?.uri) {
                  const parent = getThreadCacheOnly(
                    post.postView.record.reply.parent.uri
                  );
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
              })
              .concat([
                positivePrompt || "says", // we use "says" as the default / neutral prompt, because it will always be there in the text
                negativePrompt || "says", // it might be worth trying other default neutral prompts, like "the" or "a"
              ]),
          }),
        });
        if (!embeddingsResponse.ok) throw new Error("Failed to do AI!!");

        const embeddings = await embeddingsResponse.json();
        let embeddingByCid: { [cid: string]: number[] } = {};
        posts.forEach((post, index) => {
          embeddingByCid[post.postView.cid] = embeddings[index];
        });
        const positivePromptEmbedding = embeddings[embeddings.length - 2];
        const negativePromptEmbedding = embeddings[embeddings.length - 1];

        const postsWithSimilarity = posts.map((post) => ({
          ...post,
          score:
            cosineSimilarity(
              embeddingByCid[post.postView.cid],
              positivePromptEmbedding
            ) -
            cosineSimilarity(
              embeddingByCid[post.postView.cid],
              negativePromptEmbedding
            ),
        }));

        return {
          posts: postsWithSimilarity
            .filter((item) => item.score > minimumScore)
            .sort((a, b) => {
              const bAgo =
                Date.now() - new Date(b.postView.record.createdAt).getTime();
              const aAgo =
                Date.now() - new Date(a.postView.record.createdAt).getTime();

              if (sorting === "score") return b.score - a.score;
              if (sorting === "time") return aAgo - bAgo;

              if (sorting === "combo") {
                // 0 = sort by time, 50 ~= sort by score, 5 ~= sort by combo
                const SCORE_SENSITIVITY = 5;
                return (
                  aAgo / Math.pow(a.score, SCORE_SENSITIVITY) -
                  bAgo / Math.pow(b.score, SCORE_SENSITIVITY)
                );
              }

              return 0;
            }),
          cursor: response.data.cursor,
        };
      } else {
        throw new Error("Failed to get timeline");
      }
    },
    postProcessFeed: defaultPostProcessFeed,
  };
}
