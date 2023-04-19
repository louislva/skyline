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
async function mergeConversations_OLD(
  agent: BskyAgent,
  posts: SkylinePostType[]
): Promise<SkylinePostType[]> {
  // First, load all the replies
  await Promise.all(
    posts.map(async (post) => {
      const record = post.postView.record as RecordType;
      if (record.reply) {
        // Make sure the parent post is in the list
        const response = await agent.getPostThread({
          uri: record.reply.parent.uri,
        });

        let newPosts = [];
        if (response.success) {
          let node: ThreadViewPost | null = response.data.thread.post
            ? (response.data.thread as ThreadViewPost)
            : null;
          while (node) {
            newPosts.unshift({
              postView: node.post as SkylinePostType["postView"],
            });
            node = node.parent?.post ? (node.parent as ThreadViewPost) : null;
          }
        }

        post.replyingTo = newPosts;
      }

      return;
    })
  );

  // Then, remove all replyingTo posts from the root
  let newPosts = posts.slice();
  posts.forEach((post) => {
    post.replyingTo?.forEach((replyingToPost) => {
      newPosts = newPosts.filter(
        (p) => p.postView.cid !== replyingToPost.postView.cid
      );
    });
  });

  return newPosts;
}
const mergeConversations = mergeConversations_OLD;

function getJustPersonFeed(handle: string): TimelineDefinitionType {
  return {
    icon: "toys",
    name: "Just @" + handle,
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
    icon: "home",
    name: "Default",
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
        console.time("mergeConversations");
        const postsMerged = await mergeConversations(agent, postsSliced);
        console.timeEnd("mergeConversations");
        setPosts(postsMerged);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [timelineId]);

  return (
    <div>
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
  return (
    <div className="flex flex-col md:flex-row justify-start">
      {Object.keys(TIMELINES).map((id) => (
        <button
          key={id}
          className={`p-2 flex flex-row items-center ${
            id === timelineId ? "bg-blue-500 text-white" : ""
          }`}
          onClick={() => setTimelineId(id as TimelineIdType)}
        >
          <span className="material-icons mr-2">{TIMELINES[id].icon}</span>
          <span>{TIMELINES[id].name}</span>
        </button>
      ))}
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
    <div className="max-w-xl mx-auto border border-gray-300 rounded-xl mt-4">
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
        <div className="mt-4 mb-1 px-4 flex flex-row items-center text-sm mb-4 text-gray-700">
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
            (hasChildren ? "border-none pb-0 " : "border-b ")
          }
        >
          {/* Reply row */}

          {record.reply && (
            <div className="flex flex-row items-center text-sm mb-4 text-gray-700">
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
          <div className="mt-2">{record.text}</div>
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
    <div className="mt-32 max-w-sm bg-white p-4 rounded-xl border rounded-xl">
      <div className="flex flex-row pb-2 border-b mb-2">
        <span className="material-icons mr-2 cursor-pointer">info</span>
        <div>Is this secure?</div>
      </div>
      <b>Yes!</b> Bluesky unfortunately doesn't have an OAuth login system yet,
      but we've taken the following measures to make sure your data is safe:
      <ul>
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
            this website here.
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
