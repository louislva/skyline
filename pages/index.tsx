import LoadingSpinner from "@/components/LoadingSpinner";
import { BlobRef, BskyAgent } from "@atproto/api";
import { ProfileView } from "@atproto/api/dist/client/types/app/bsky/actor/defs";
import {
  PostView,
  ThreadViewPost,
} from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import moment from "moment";
import Head from "next/head";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
const cosineSimilarity = require("compute-cosine-similarity");

let followsCache: ProfileView[] | null = null;
let followersCache: ProfileView[] | null = null;

// HELPERS
async function getFollows(
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
async function getMutuals(
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
async function mergeConversationsContinual(
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
          let newPosts = [];
          try {
            const response = await agent.getPostThread({
              uri: record.reply.parent.uri,
            });

            if (response.success) {
              let node: ThreadViewPost | null = response.data.thread.post
                ? (response.data.thread as ThreadViewPost)
                : null;
              while (node) {
                newPosts.unshift({
                  postView: node.post as ExpandedPostView,
                });
                node = node.parent?.post
                  ? (node.parent as ThreadViewPost)
                  : null;
              }
            }
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
}
function useLocalStorageState<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  // First checks localStorage
  // If not found, uses defaultValue
  // Otherwise, uses the value from localStorage
  // Every time the state is set, it is also saved to localStorage

  const [state, setState] = useState<T>(() => {
    const value = localStorage.getItem(key);
    if (value) {
      return JSON.parse(value);
    } else {
      return defaultValue;
    }
  });

  const setStateAndSave = (value: T) => {
    localStorage.setItem(key, JSON.stringify(value));
    setState(value);
  };

  return [state, setStateAndSave];
}

// Feeds
function makeSinglePersonFeed(handle: string): TimelineDefinitionType {
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
function makeFollowingFeed(): TimelineDefinitionType {
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
function makeOneFromEachFeed(): TimelineDefinitionType {
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
function makeMutualsFeed(): TimelineDefinitionType {
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
function makeEmbeddingsFeed(
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
            // .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score),
          cursor: response.data.cursor,
        };
      } else {
        throw new Error("Failed to get timeline");
      }
    },
  };
}

type RecordType = {
  text: string;
  createdAt: string;
  reply?: {
    parent: {
      cid: string;
      uri: string;
    };
    root: {
      cid: string;
      uri: string;
    };
  };
  embed?: {
    $type: "app.bsky.embed.images" | string;
    images?: {
      alt: string;
      image: BlobRef;
    }[];
  };
};
type ExpandedPostView = PostView & {
  record: RecordType;
};
type SkylinePostType = {
  // Post itself
  postView: ExpandedPostView;

  // Things to-do with post type
  replyingTo?: SkylinePostType[];
  repostBy?: ProfileView;

  // Algorithm / Skyline-native stuff
  score?: number;
  notRoot?: true;
};
type TimelineDefinitionType = {
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
type TimelinesType = {
  [id: string]: TimelineDefinitionType;
};
type CustomAITimelinesType = {
  [id: string]: {
    name: string;
    positivePrompt: string;
    negativePrompt: string;
  };
};

// TIMELINES
const TIMELINES: {
  [id: string]: TimelineDefinitionType;
} = {
  following: makeFollowingFeed(),
  "one-from-each": makeOneFromEachFeed(),
  mutuals: makeMutualsFeed(),
  wholesome: {
    ...makeEmbeddingsFeed(
      "Wholesome tweet, kindness, love, fun banter",
      "Angry tweets, with politics, people talking about gender & dating, etc."
    ),
    icon: "favorite",
    name: "Wholesome",
    description:
      "AI-feed boosting wholesome tweets, and removing angry / political / culture war tweets",
  },
};
type TimelineIdType = keyof typeof TIMELINES;

// TIMELINE SCREEN
function TimelineScreen(props: {
  identifier: string;
  setIdentifier: (identifier: string | null) => void;
  agent: BskyAgent;
}) {
  const { identifier, setIdentifier, agent } = props;
  const [timelineId, setTimelineId] = useState<TimelineIdType>("following");
  const [customAITimelines, setCustomAITimelines] =
    useLocalStorageState<CustomAITimelinesType>("@customAITimelines", {});

  const timelines = useMemo(() => {
    return {
      ...TIMELINES,
      ...Object.fromEntries(
        Object.entries(customAITimelines).map(([id, config]) => {
          const { name, positivePrompt, negativePrompt } = config;
          return [
            id,
            {
              ...makeEmbeddingsFeed(positivePrompt, negativePrompt),
              name: name,
              // a material icon that symbolizes "custom"
              icon: "bolt",
              description: `Custom timeline, created to show more "${positivePrompt.trim()}" and less "${negativePrompt.trim()}"`,
            },
          ] as [string, TimelineDefinitionType];
        })
      ),
    };
  }, [customAITimelines]);

  const [createTimelineModal, setCreateTimelineModalOpen] = useState(false);

  return (
    <div className="w-full flex flex-col items-center px-2">
      <Header />
      <TimelinePicker
        timelineId={timelineId}
        setTimelineId={setTimelineId}
        timelines={timelines}
        setCreateTimelineModalOpen={setCreateTimelineModalOpen}
      />
      <Timeline
        key={timelineId}
        timelineId={timelineId}
        agent={agent}
        identifier={identifier}
        timelines={timelines}
      />
      {createTimelineModal && (
        <CreateTimelineModal
          customAITimelines={customAITimelines}
          setCustomAITimelines={setCustomAITimelines}
          setOpen={setCreateTimelineModalOpen}
        />
      )}
    </div>
  );
}

function Header() {
  const subheaders = [
    "it's a memorable domain! (and it was $5 off)",
    "better algorithms make better people",
    "the skyline is the timeline on bluesky",
  ];
  const [subheader, setSubheader] = useState<string>("");
  useEffect(() => {
    setSubheader(subheaders[Math.floor(Math.random() * subheaders.length)]);
  }, []);

  return (
    <>
      <div className="text-xl font-light mt-4">
        {/* spells skyline.gay in pride flag colors */}
        <span className="text-red-500">s</span>
        <span className="text-orange-500">k</span>
        <span className="text-yellow-500">y</span>
        <span className="text-green-500">l</span>
        <span className="text-blue-500">i</span>
        <span className="text-purple-500">n</span>
        <span className="text-pink-500">e</span>
      </div>
      <div className="text-sm font-light text-black/70 mb-4">{subheader}</div>
    </>
  );
}

function TimelinePicker(props: {
  timelineId: TimelineIdType;
  setTimelineId: (timelineId: TimelineIdType) => void;
  timelines: typeof TIMELINES;
  setCreateTimelineModalOpen: (open: boolean) => void;
}) {
  const { timelineId, setTimelineId, timelines, setCreateTimelineModalOpen } =
    props;
  const [hoveredTimelineId, setHoveredTimelineId] =
    useState<TimelineIdType | null>(null);

  return (
    <div className="flex flex-col items-center mb-4">
      <div className="flex flex-col lg:flex-row items-center">
        <div className="flex flex-col lg:flex-row justify-start rounded-md border overflow-hidden">
          {Object.keys(timelines).map((id, index) => {
            const isSelected = id === timelineId;

            return (
              <button
                key={id}
                className={`p-2 h-10 flex flex-row items-center ${
                  id === timelineId ? "bg-blue-500 text-white" : ""
                } ${index !== 0 ? "sm:border-l " : ""}`}
                onClick={() => {
                  setTimelineId(id as TimelineIdType);
                  setHoveredTimelineId(null);
                }}
                onMouseEnter={() => {
                  setHoveredTimelineId(id as TimelineIdType);
                }}
                onMouseMove={() => {
                  setHoveredTimelineId(id as TimelineIdType);
                }}
                onMouseLeave={() => {
                  setHoveredTimelineId(null);
                }}
              >
                <span className="material-icons mr-2">
                  {timelines[id].icon}
                </span>
                <span>{timelines[id].name}</span>
              </button>
            );
          })}
        </div>
        <button
          className="p-2 flex flex-row items-center justify-center border rounded-md ml-0 lg:ml-2 mt-2 lg:mt-0 lg:w-8 h-8 px-2 lg:px-0"
          onClick={() => {
            setCreateTimelineModalOpen(true);
          }}
        >
          <span className="material-icons mr">add</span>
          <span className="inline lg:hidden pl-1">Custom Timeline</span>
        </button>
      </div>

      {hoveredTimelineId && (
        <div className="max-w-xl text-sm text-black/70 mt-2 text-center">
          <b>{timelines[hoveredTimelineId].name}:</b>{" "}
          {timelines[hoveredTimelineId].description}
        </div>
      )}
    </div>
  );
}

function Timeline(props: {
  agent: BskyAgent;
  identifier: string;
  timelineId: TimelineIdType;
  timelines: TimelinesType;
}) {
  const { agent, identifier, timelineId, timelines } = props;

  const [posts, setPosts] = useState<SkylinePostType[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    setCursor(undefined);
    setPosts([]);
    setLoading(true);

    timelines[timelineId]
      .produceFeed({
        agent,
        egoIdentifier: identifier,
        cursor,
      })
      .then(async (result) => {
        const postsSliced = result.posts;
        mergeConversationsContinual(agent, postsSliced, (postsMerged) => {
          setPosts(postsMerged);
          setLoading(false);
        });
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [timelineId]);

  return (
    <div className="border-2 w-full sm:w-136 border-gray-300 rounded-xl mb-8 overflow-hidden">
      {loading ? (
        <div className="flex flex-row justify-center items-center text-3xl py-32">
          <LoadingSpinner
            containerClassName="w-12 h-12 mr-4"
            dotClassName="bg-black/70"
          />
          <div className="text-black/70">Loading...</div>
        </div>
      ) : (
        posts.map((post, index) => (
          <Post
            agent={agent}
            key={post.postView.cid + "index" + index}
            post={post}
            isLastPost={index === posts.length - 1}
          />
        ))
      )}
    </div>
  );
}
function Post(props: {
  agent: BskyAgent;
  post: SkylinePostType;
  hasChildren?: boolean;
  isLastPost?: boolean;
}) {
  const { agent, post, hasChildren, isLastPost } = props;
  const author = post.postView.author;
  const embed:
    | {
        $type: "app.bsky.embed.record#view" | "app.bsky.embed.images" | string;
        images?:
          | {
              alt: string;
              fullsize: string;
              thumb: string;
            }[]
          | undefined;
        record?: {
          author: PostView["author"];
          value: RecordType;
        };
      }
    | undefined = post.postView.embed as any;
  const record: RecordType = post.postView.record as any;

  const bskyLink = `https://staging.bsky.app/profile/${author.handle}/post/${
    post.postView.uri.split("/").slice(-1)[0]
  }`;

  const replyPosts: SkylinePostType[] = post.replyingTo || [];

  return (
    <>
      {replyPosts.slice(0, 1).map((reply) => (
        <Post
          key={reply.postView.cid + "as child to" + post.postView.cid}
          agent={agent}
          post={reply}
          hasChildren
        />
      ))}
      {replyPosts.length > 2 && (
        <div className="mt-0 mb-0 px-4 flex flex-row items-center text-sm mb-4 text-gray-700">
          <div className="text-xl mr-1 -mt-2">...</div>
          {replyPosts.length - 2} more replies{" "}
          <div className="text-xl ml-1 -mt-2">...</div>
        </div>
      )}
      {replyPosts.length > 1 &&
        replyPosts
          .slice(-1)
          .map((reply) => (
            <Post
              key={
                reply.postView.cid + "as a later child to" + post.postView.cid
              }
              agent={agent}
              post={reply}
              hasChildren
            />
          ))}
      <Link href={bskyLink} target="_blank">
        <div
          className={
            "p-4 overflow-hidden " +
            (hasChildren || isLastPost
              ? "border-none "
              : "border-b border-gray-300 ")
          }
        >
          {/* Reply row */}
          {record.reply && (
            <div className="flex flex-row items-center text-sm pt-2 pb-2 -mt-4 text-gray-700 border-t border-dashed">
              <div className="material-icons mr-1">reply</div>
              <div>In reply to</div>
            </div>
          )}

          {/* Profile row */}
          <div className="flex flex-row">
            {/* Pfp */}
            {author.avatar && (
              <div className="w-12 h-12 mr-3 rounded-full overflow-hidden">
                <img src={author.avatar} alt={author.name + "'s avatar"} />
              </div>
            )}
            {/* Name / handle */}
            <div className="flex flex-col">
              <div className="font-semibold">{author.displayName}</div>
              <div className="text-gray-500">
                {author.handle ===
                "deepfates.com.deepfates.com.deepfates.com.deepfates.com.deepfates.com"
                  ? "i'm an asshole 💩"
                  : "@" + author.handle}
              </div>
            </div>
            {/* timestamp */}
            <div className="flex-grow text-right text-gray-500">
              {moment(post.postView.indexedAt).fromNow()}
            </div>
          </div>
          {/* Content row */}
          <div className="mt-2">
            {record.text.split("\n").map((line, index) => (
              <Fragment key={line + "$" + index}>
                {index !== 0 && <br />}
                {line}
              </Fragment>
            ))}
          </div>
          {/* Images */}
          {embed?.images && (
            <div className="mt-2 flex flex-row h-72 gap-4">
              {embed.images.slice(0, 3).map((image) => (
                <div
                  className="flex-1 rounded-md overflow-hidden"
                  key={image.thumb}
                >
                  <img
                    src={image.thumb}
                    alt={image.alt}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
          {/* Quote tweets */}
          {embed?.record?.value?.text && (
            <div className="mt-2 border rounded-md p-2 py-2 text-sm">
              <div className="flex flex-row items-center h-4 text-gray-700 bg-green-4000 mb-1">
                <img
                  src={embed.record.author.avatar}
                  className="w-4 h-4 rounded-full mr-1"
                />
                <span className="font-semibold mr-1 leading-none">
                  {embed.record.author.displayName}
                </span>
                <span className="text-gray-500 leading-none">
                  {" "}
                  @{embed.record.author.handle}
                </span>
              </div>
              <div className="bg-blue-4000">
                {embed?.record?.value?.text?.split("\n").map((line, index) => (
                  <Fragment key={line + "$" + index}>
                    {index !== 0 && <br />}
                    {line}
                  </Fragment>
                ))}
              </div>
            </div>
          )}
          {/* Likes, RTs, etc. row */}
          <div className="flex flex-row items-center text-base mt-3 text-gray-700 leading-none">
            <div className="material-icons mr-1">chat_bubble_outline</div>
            <div className="mr-4">{post.postView.replyCount}</div>
            <div className="material-icons mr-1">repeat</div>
            <div className="mr-4">{post.postView.repostCount}</div>
            <div className="material-icons mr-1">favorite_border</div>
            <div className="mr-4">{post.postView.likeCount}</div>
            {post.score && (
              <>
                {/* cog icon / settings icon bec it's a machine */}
                <div className="material-icons ml-auto mr-1 text-gray-400">
                  settings
                </div>
                <div className="text-gray-400">
                  {(
                    Math.pow(Math.abs(post.score), 0.3) *
                    Math.sign(post.score) *
                    100
                  ).toFixed(0)}
                  % match
                </div>
              </>
            )}
          </div>
        </div>
      </Link>
    </>
  );
}

function CreateTimelineModal(props: {
  customAITimelines: CustomAITimelinesType;
  setCustomAITimelines: (timelines: CustomAITimelinesType) => void;
  setOpen: (open: boolean) => void;
}) {
  const { customAITimelines, setCustomAITimelines, setOpen } = props;
  const [name, setName] = useState("");
  const [positivePrompt, setPositivePrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");

  return (
    <div
      className="fixed top-0 left-0 w-screen h-screen bg-black/50 backdrop-blur-md	flex justify-center items-center"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white rounded-lg p-4 w-128"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xl font-bold mb-4">Create a timeline</div>
        <div className="flex flex-col gap-2">
          <label>Title</label>
          <input
            type="text"
            placeholder="Wholesome TL"
            className="border border-gray-300 rounded-md p-2 w-1/2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label className="flex flex-row items-center">
            I want to see more of...
            <span className="material-icons text-green-600 ml-1">thumb_up</span>
          </label>
          <input
            type="text"
            placeholder="Wholesome tweets, kindness, love, fun banter"
            className="border border-gray-300 rounded-md p-2"
            value={positivePrompt}
            onChange={(e) => setPositivePrompt(e.target.value)}
          />
          <label className="flex flex-row items-center">
            I want to see less of...
            <span className="material-icons text-red-600 ml-1">thumb_down</span>
          </label>
          <input
            type="text"
            placeholder="Angry tweets, like tweets with politics, dating discourse, dunks"
            className="border border-gray-300 rounded-md p-2"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
          />
          <button
            className="bg-blue-500 text-white rounded-md p-2 w-1/3 mt-4 ml-auto"
            onClick={() => {
              setCustomAITimelines({
                ...customAITimelines,
                [Date.now().toString()]: {
                  name: name.trim(),
                  positivePrompt: positivePrompt.trim(),
                  negativePrompt: negativePrompt.trim(),
                },
              });
              setOpen(false);
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// LOGIN SCREEN
function LoginScreen(props: {
  setIdentifier: (identifier: string | null) => void;
  agent: BskyAgent;
}) {
  const { setIdentifier, agent } = props;
  const login = (username: string, password: string) => {
    setError(null);
    agent
      .login({
        identifier: username,
        password: password,
      })
      .then((response) => {
        if (response.success) {
          setIdentifier(response.data.did);
        } else {
          // Error
          setIdentifier(null);
          setError("Error");
        }
      })
      .catch((err) => {
        // Error
        setIdentifier(null);
        setError(err.message);
      });
  };

  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<null | string>(null);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <Header />
      {/* An offset equal to the security info (ish) */}
      <div className="h-32" />
      {/* The title */}
      <h1 className="text-3xl font-bold mb-6">Login to Bluesky</h1>
      {/* The login form */}
      <form
        className="flex flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          login(username, password);
        }}
      >
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border border-gray-300 p-2 rounded mb-4"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border border-gray-300 p-2 rounded mb-4"
        />
        <button type="submit" className="bg-blue-500 text-white p-2 rounded">
          Login
        </button>
      </form>
      {error && <p className="text-red-500 mt-4">{error}</p>}
      {/* Security policy section */}
      <SecurityInfo />
    </div>
  );
}
function SecurityInfo() {
  return (
    <div className="mt-32 max-w-sm bg-white p-4 rounded-xl border rounded-xl mb-8">
      <div className="flex flex-row pb-2 border-b mb-2">
        <span className="material-icons mr-2 cursor-pointer">info</span>
        <div>Is this secure?</div>
      </div>
      <b>Yes!</b> Bluesky unfortunately doesn't have an OAuth login system yet,
      but we've taken the following measures to make sure your data is safe:
      <ul className="list-disc list-inside">
        <li>
          We don't send your password to our own servers. Every request is made
          directly from <i>your</i> browser to Bluesky's servers.
        </li>
        <li>
          We don't store your password anywhere. Not on the backend, not on the
          frontend, not in cookies, nowhere.
        </li>
        <li>
          If you don't trust us, you can always check the source code of{" "}
          <a
            href="https://github.com/louislva/skyline"
            className="text-blue-500"
            target="_blank"
          >
            the service here.
          </a>
        </li>
      </ul>
    </div>
  );
}

export default function Main() {
  const [identifier, setIdentifier] = useState<string | null>(null);
  const agent = useRef<BskyAgent>(
    new BskyAgent({
      service: "https://bsky.social",
    })
  ).current;

  return (
    <>
      <Head>
        <title>Skyline</title>
        <link rel="icon" href="/skyline-16.png" />
      </Head>
      {identifier ? (
        <TimelineScreen
          identifier={identifier}
          setIdentifier={setIdentifier}
          agent={agent}
        />
      ) : (
        <LoginScreen setIdentifier={setIdentifier} agent={agent} />
      )}
    </>
  );
}
