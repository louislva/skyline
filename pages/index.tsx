import LoadingSpinner from "@/components/LoadingSpinner";
import { BlobRef, BskyAgent } from "@atproto/api";
import { ProfileView } from "@atproto/api/dist/client/types/app/bsky/actor/defs";
import {
  PostView,
  ThreadViewPost,
} from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import moment from "moment";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
const cosineSimilarity = require("compute-cosine-similarity");

// HELPERS
async function getFollows(
  agent: BskyAgent,
  identifier: string,
  maxPages: number = 10
) {
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
  return follows;
}
async function mergeConversationsContinual(
  agent: BskyAgent,
  allPosts_: SkylinePostType[],
  callback: (posts: SkylinePostType[]) => void
) {
  const WINDOW = 10;

  const allPosts: SkylinePostType[] = JSON.parse(JSON.stringify(allPosts_));
  let newPosts = allPosts.slice();

  for (let i = 0; i < allPosts.length; i += WINDOW) {
    const posts = allPosts.slice(i, i + WINDOW);
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
                  postView: node.post as SkylinePostType["postView"],
                });
                node = node.parent?.post
                  ? (node.parent as ThreadViewPost)
                  : null;
              }
            }
          } catch (error) {
            console.log("Error loading parent post");
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

function getJustPersonFeed(handle: string): TimelineDefinitionType {
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
              if (item.post) return true;
              else {
                console.log("NO POST", item);
                return false;
              }
            })
            .map((item) => {
              const repostBy: ProfileView | undefined =
                item.reason?.$type === "app.bsky.feed.defs#reasonRepost"
                  ? (item.reason.by as ProfileView)
                  : undefined;

              return {
                postView: item.post as SkylinePostType["postView"],
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

type SkylinePostType = {
  postView: PostView & {
    record: RecordType;
  };
  replyingTo?: SkylinePostType[];
  notRoot?: true;
  repostBy?: ProfileView;
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

// TIMELINES
const TIMELINES: {
  [id: string]: TimelineDefinitionType;
} = {
  bskyDefault: {
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
            postView: item.post as SkylinePostType["postView"],
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
  },
  oneFromEach: {
    icon: "people",
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
  },
  algo: {
    icon: "trending_up",
    name: "Algo",
    description: "AI, bitch!",
    produceFeed: async ({ agent, cursor }) => {
      const response = await agent.getTimeline({
        cursor,
        limit: 100,
      });
      if (response.success) {
        const posts = response.data.feed.map((item) => ({
          postView: item.post as SkylinePostType["postView"],
          repostBy:
            item.reason?.$type === "app.bsky.feed.defs#reasonRepost"
              ? (item.reason.by as ProfileView)
              : undefined,
        }));

        const sortingPrompt = "Really famous tweet, lots of attention";
        const embeddingsResponse = await fetch("/api/embeddings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: posts
              .map((post) => {
                const text = `${post.postView.author.displayName} (@${post.postView.author.handle}) says:\n\n${post.postView.record.text}\n\n[${post.postView.likeCount} likes, ${post.postView.replyCount} replies, ${post.postView.repostCount} reposts]`;
                console.log(text);
                return text;
              })
              .concat(sortingPrompt),
          }),
        });
        if (!embeddingsResponse.ok) throw new Error("Failed to do AI!!");

        const embeddings = await embeddingsResponse.json();
        let embeddingByCid: { [cid: string]: number[] } = {};
        posts.forEach((post, index) => {
          embeddingByCid[post.postView.cid] = embeddings[index];
        });
        const sortingPromptEmbedding = embeddings[embeddings.length - 1];

        const postsWithSimilarity = posts.map((post) => ({
          ...post,
          similarity: cosineSimilarity(
            embeddingByCid[post.postView.cid],
            sortingPromptEmbedding
          ),
        }));

        console.log(postsWithSimilarity);

        return {
          posts: postsWithSimilarity.sort(
            (a, b) => b.similarity - a.similarity
          ),
          cursor: response.data.cursor,
        };
      } else {
        throw new Error("Failed to get timeline");
      }
    },
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
  const [timelineId, setTimelineId] = useState<TimelineIdType>("bskyDefault");
  const [posts, setPosts] = useState<SkylinePostType[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    setCursor(undefined);
    setPosts([]);
    setLoading(true);

    console.time("produceFeed");
    TIMELINES[timelineId]
      .produceFeed({
        agent,
        egoIdentifier: identifier,
        cursor,
      })
      .then(async (result) => {
        console.timeEnd("produceFeed");
        const postsSliced = result.posts.slice(0, 50);
        console.time("mergeConversationsFirst10");
        mergeConversationsContinual(agent, postsSliced, (postsMerged) => {
          console.timeEnd("mergeConversationsFirst10");
          setPosts(postsMerged);
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [timelineId]);

  return (
    <div className="w-full flex flex-col items-center px-2">
      <div className="text-xl font-light mt-4">
        {/* spells skyline.gay in pride flag colors */}
        <span className="text-red-500">s</span>
        <span className="text-orange-500">k</span>
        <span className="text-yellow-500">y</span>
        <span className="text-green-500">l</span>
        <span className="text-blue-500">i</span>
        <span className="text-purple-500">n</span>
        <span className="text-pink-500">e</span>
        <span className="text-gray-600">.gay</span>
      </div>
      <div className="text-sm font-light text-black/70 mb-4">
        it's a memorable domain! (and it was $5 off)
      </div>
      <TimelinePicker timelineId={timelineId} setTimelineId={setTimelineId} />
      <Timeline
        key={timelineId}
        agent={agent}
        posts={posts}
        loading={loading}
      />
    </div>
  );
}
function TimelinePicker(props: {
  timelineId: TimelineIdType;
  setTimelineId: (timelineId: TimelineIdType) => void;
}) {
  const { timelineId, setTimelineId } = props;
  const [hoveredTimelineId, setHoveredTimelineId] =
    useState<TimelineIdType | null>(null);

  return (
    <div className="flex flex-col items-center mb-4">
      <div className="flex flex-col sm:flex-row justify-start rounded-md border overflow-hidden">
        {Object.keys(TIMELINES).map((id, index) => {
          const isSelected = id === timelineId;

          return (
            <button
              key={id}
              className={`p-2 flex flex-row items-center ${
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
              <span className="material-icons mr-2">{TIMELINES[id].icon}</span>
              <span>{TIMELINES[id].name}</span>
            </button>
          );
        })}
      </div>

      {hoveredTimelineId && (
        <div className="max-w-xl text-sm text-black/70 mt-2 text-center">
          <b>{TIMELINES[hoveredTimelineId].name}:</b>{" "}
          {TIMELINES[hoveredTimelineId].description}
        </div>
      )}
    </div>
  );
}
function Timeline(props: {
  agent: BskyAgent;
  posts: SkylinePostType[];
  loading: boolean;
}) {
  const { posts, agent, loading } = props;

  return (
    <div className="border-2 w-full sm:w-136 border-gray-300 rounded-xl">
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
          />
        ))
      )}
    </div>
  );
}
function Post(props: {
  agent: BskyAgent;
  post: SkylinePostType;
  disableParentLoading?: boolean;
  hasChildren?: boolean;
}) {
  const { agent, post, disableParentLoading, hasChildren } = props;
  const author = post.postView.author;
  const embed:
    | {
        images?:
          | {
              alt: string;
              fullsize: string;
              thumb: string;
            }[]
          | undefined;
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
          disableParentLoading
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
              key={reply.postView.cid}
              agent={agent}
              post={reply}
              disableParentLoading
              hasChildren
            />
          ))}
      <Link href={bskyLink} target="_blank">
        <div
          className={
            "p-4 overflow-hidden " +
            (hasChildren ? "border-none " : "border-b border-gray-300 ")
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
              <>
                {index !== 0 && <br />}
                {line}
              </>
            ))}
          </div>
          {/* Embeds row */}
          {embed?.images && (
            <div className="mt-2 flex flex-row h-72 gap-4">
              {embed.images.slice(0, 3).map((image) => (
                <div className="flex-1 rounded-md overflow-hidden">
                  <img
                    src={image.fullsize}
                    alt={image.alt}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
          {/* Likes, RTs, etc. row */}
          <div className="flex flex-row items-center text-base mt-3 text-gray-700 leading-none">
            <div className="material-icons mr-1">chat_bubble_outline</div>
            <div>{post.postView.replyCount}</div>
            <div className="material-icons mr-1 ml-4">repeat</div>
            <div>{post.postView.repostCount}</div>
            <div className="material-icons mr-1 ml-4">favorite_border</div>
            <div>{post.postView.likeCount}</div>
          </div>
        </div>
      </Link>
    </>
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
      {/* An offset equal to the security info (ish) */}
      <div className="h-72" />
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

  return identifier ? (
    <TimelineScreen
      identifier={identifier}
      setIdentifier={setIdentifier}
      agent={agent}
    />
  ) : (
    <LoginScreen setIdentifier={setIdentifier} agent={agent} />
  );
}
