import { BskyAgent } from "@atproto/api";
import { ExpandedPostView, SkylinePostType } from "./contentTypes";
import { ProfileView } from "@atproto/api/dist/client/types/app/bsky/actor/defs";
import { getFollows, getMutuals } from "./bsky";
import { PostView } from "@atproto/api/dist/client/types/app/bsky/feed/defs";
const cosineSimilarity = require("compute-cosine-similarity");

export type TimelineDefinitionType = {
  icon: string;
  name: string;
  description: string;
  produceFeed: (params: {
    agent: BskyAgent;
    egoIdentifier: string;
    cursor: string | undefined;
  }) => Promise<{
    posts: SkylinePostType[];
    cursor: string | undefined;
  }>;
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
  };
}
export function makeFollowingFeed(): TimelineDefinitionType {
  return {
    icon: "person_add",
    name: "Following",
    description: "Posts from people you follow, in reverse chronological order",
    produceFeed: async ({ agent, cursor }) => {
      const response = await agent.getTimeline({
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
  };
}
export function makeEmbeddingsFeed(
  positivePrompt: string | null,
  negativePrompt: string | null
): TimelineDefinitionType {
  return {
    icon: "trending_up",
    name: "AI feed",
    description: `Posts like "${positivePrompt}" and unlike "${negativePrompt}"`,
    produceFeed: async ({ agent, cursor }) => {
      const response = await agent.getTimeline({
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
                const embed = post.postView.embed;
                // @ts-ignore
                const quote = embed?.record?.value?.text
                  ? // @ts-ignore
                    `${embed?.record?.author?.displayName} (@${
                      // @ts-ignore
                      embed?.record?.author?.handle
                      // @ts-ignore
                    }) says:\n\n${embed?.record?.value?.text?.trim()}`
                  : "";
                const text = `${post.postView.author.displayName} (@${
                  post.postView.author.handle
                }) says:\n\n${post.postView.record.text.trim()}${
                  quote
                    ? "\n" +
                      quote
                        .split("\n")
                        .map((line) => `\n> ${line}`)
                        .join("")
                    : ""
                }`;
                return text;
              })
              .concat([positivePrompt || "says", negativePrompt || "says"]),
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
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score),
          cursor: response.data.cursor,
        };
      } else {
        throw new Error("Failed to get timeline");
      }
    },
  };
}
