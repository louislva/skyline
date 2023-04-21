import LoadingSpinner from "@/components/LoadingSpinner";
import {
  LoginResponseDataType,
  mergeConversationsContinual,
} from "@/helpers/bsky";
import { RecordType, SkylinePostType } from "@/helpers/contentTypes";
import { useLocalStorageState } from "@/helpers/hooks";
import {
  TimelineDefinitionType,
  makeEmbeddingsFeed,
  makeFollowingFeed,
  makeMutualsFeed,
  makeOneFromEachFeed,
} from "@/helpers/makeFeeds";
import { BskyAgent } from "@atproto/api";
import { PostView } from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import * as jwt from "jsonwebtoken";
import moment from "moment";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  Fragment,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// TIMELINES
type TimelinesType = {
  [id: string]: TimelineDefinitionType;
};
type CustomTimelineType = {
  name: string;
  positivePrompt: string;
  negativePrompt: string;
  sharedBy?: string;
};
type CustomTimelinesType = {
  [id: string]: CustomTimelineType;
};
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
type TimelineIdType = string;

// TIMELINE SCREEN
function TimelineScreen(props: {
  setLoginResponseData: (value: LoginResponseDataType | null) => void;
  egoIdentifier: string;
  agent: BskyAgent;
  customTimelines: CustomTimelinesType;
  setCustomTimelines: (value: CustomTimelinesType) => void;
}) {
  const {
    setLoginResponseData,
    egoIdentifier,
    agent,
    customTimelines,
    setCustomTimelines,
  } = props;

  const timelines = useMemo(() => {
    return {
      ...TIMELINES,
      ...Object.fromEntries(
        Object.entries(customTimelines).map(([id, config]) => {
          const { name, positivePrompt, negativePrompt, sharedBy } = config;
          return [
            id,
            {
              ...makeEmbeddingsFeed(positivePrompt, negativePrompt),
              name: name,
              // a material icon that symbolizes "custom"
              icon: sharedBy ? "public" : "bolt",
              description:
                (positivePrompt.trim() && negativePrompt.trim()) ||
                (!positivePrompt.trim() && !negativePrompt.trim())
                  ? `Custom timeline, created to show more "${positivePrompt.trim()}" and less "${negativePrompt.trim()}"`
                  : negativePrompt.trim()
                  ? `Custom timeline, created not to show "${negativePrompt.trim()}"`
                  : `Custom timeline, created to show more "${positivePrompt.trim()}"`,
            },
          ] as [string, TimelineDefinitionType];
        })
      ),
    };
  }, [customTimelines]);

  const [timelineId_, setTimelineId] = useLocalStorageState<TimelineIdType>(
    "@timelineId",
    "following"
  );
  // fallback if your localStorage stored timelineId doesn't exist any more
  const timelineId = timelines[timelineId_] ? timelineId_ : "following";

  const [createTimelineModal, setCreateTimelineModalOpen] = useState(false);
  const [editingCustomAITimelineId, setEditingCustomAITimelineId] = useState<
    string | null
  >(null);

  return (
    <div className="w-full flex flex-col items-center px-2">
      <Header logout={() => setLoginResponseData(null)} />
      <TimelinePicker
        timelineId={timelineId}
        setTimelineId={setTimelineId}
        egoIdentifier={egoIdentifier}
        timelines={timelines}
        setCreateTimelineModalOpen={setCreateTimelineModalOpen}
        setEditingCustomAITimelineId={setEditingCustomAITimelineId}
        customTimelines={customTimelines}
        setCustomTimelines={setCustomTimelines}
      />
      <Timeline
        key={timelineId}
        timelineId={timelineId}
        agent={agent}
        identifier={egoIdentifier}
        timelines={timelines}
      />
      {(createTimelineModal || editingCustomAITimelineId) && (
        <ConfigureTimelineModal
          customTimelines={customTimelines}
          setCustomTimelines={setCustomTimelines}
          close={() => {
            setCreateTimelineModalOpen(false);
            setEditingCustomAITimelineId(null);
          }}
          editingCustomAITimelineId={editingCustomAITimelineId}
        />
      )}
    </div>
  );
}

function Header(props: { logout?: () => void }) {
  const { logout } = props;
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
      <div className="w-full flex flex-row items-center justify-center">
        <div className="sm:flex-1"></div>
        <div className="flex flex-col items-start sm:items-center py-4">
          <div className="text-xl font-light">
            {/* spells skyline.gay in pride flag colors */}
            <span className="text-red-500">s</span>
            <span className="text-orange-500">k</span>
            <span className="text-yellow-500">y</span>
            <span className="text-green-500">l</span>
            <span className="text-blue-500">i</span>
            <span className="text-purple-500">n</span>
            <span className="text-pink-500">e</span>
          </div>
          <div className="text-sm font-light text-slate-900 dark:text-slate-300">
            {subheader}
          </div>
        </div>
        <div className="flex-1 flex flex-row justify-end items-center">
          {logout && (
            <button
              className="text-base border py-2 px-4 rounded-lg flex flex-row items-center ml-4 mr-0 sm:mr-3 text-slate-800 bg-white border-gray-300 dark:text-slate-50 dark:bg-slate-800 dark:border-slate-700"
              onClick={() => logout()}
            >
              <span className="material-icons mr-2">logout</span>
              Logout
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function TimelinePicker(props: {
  timelineId: TimelineIdType;
  setTimelineId: (timelineId: TimelineIdType) => void;
  customTimelines: CustomTimelinesType;
  setCustomTimelines: (value: CustomTimelinesType) => void;
  egoIdentifier: string;
  timelines: typeof TIMELINES;
  setCreateTimelineModalOpen: (open: boolean) => void;
  setEditingCustomAITimelineId: (id: string | null) => void;
}) {
  const {
    timelineId,
    setTimelineId,
    customTimelines,
    setCustomTimelines,
    egoIdentifier,
    timelines,
    setCreateTimelineModalOpen,
    setEditingCustomAITimelineId,
  } = props;
  const [hoveredTimelineId, setHoveredTimelineId] =
    useState<TimelineIdType | null>(null);

  return (
    <div className="flex flex-col items-center mb-4">
      <div className="flex flex-col lg:flex-row items-center">
        <div className="flex flex-col lg:flex-row justify-start rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 overflow-hidden">
          {Object.keys(timelines).map((id, index) => {
            const isSelected = id === timelineId;

            return (
              <button
                key={id}
                className={`p-2 h-10 flex flex-row items-center border-slate-300 dark:border-slate-600 ${
                  id === timelineId
                    ? "bg-blue-500 dark:bg-slate-600 text-slate-50 "
                    : ""
                } ${index !== 0 ? "lg:border-l " : ""}`}
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
          className="p-2 flex flex-row items-center justify-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md ml-0 lg:ml-2 mt-2 lg:mt-0 lg:w-8 h-8 px-2 lg:px-0"
          onClick={() => {
            setCreateTimelineModalOpen(true);
          }}
        >
          <span className="material-icons mr">add</span>
          <span className="inline lg:hidden pl-1">Custom Timeline</span>
        </button>
      </div>

      <div className="max-w-xl text-sm text-slate-800 dark:text-slate-400 mt-2 text-center">
        <b>{timelines[hoveredTimelineId || timelineId].name}:</b>{" "}
        {timelines[hoveredTimelineId || timelineId].description}
      </div>
      {(!hoveredTimelineId || hoveredTimelineId === timelineId) && (
        <div className="flex flex-row justify-center items-center text-sm mt-2 gap-2">
          {!Object.keys(TIMELINES).includes(timelineId) && (
            <>
              <ShareTimelineButton
                key={timelineId}
                timelineConfig={customTimelines[timelineId]}
                egoIdentifier={egoIdentifier}
              />
              <button
                className="h-6 px-1 border rounded flex flex-row items-center justify-center dark:bg-yellow-700 dark:border-yellow-600 dark:text-yellow-100 bg-yellow-300 border-yellow-400"
                onClick={() => {
                  setEditingCustomAITimelineId(timelineId);
                }}
              >
                <span className="material-icons mr-1">edit</span>
                Edit
              </button>
              <button
                className="h-6 px-1 border rounded flex flex-row items-center justify-center dark:bg-red-700 dark:border-red-600 dark:text-red-100 bg-red-300 border-red-400"
                onClick={() => {
                  // are you sure alert?
                  if (
                    confirm(
                      `Are you sure you want to delete "${customTimelines[timelineId].name}"?`
                    )
                  ) {
                    const newCustomTimelines = {
                      ...customTimelines,
                    };
                    delete newCustomTimelines[timelineId];
                    setCustomTimelines(newCustomTimelines);
                    setTimelineId("following");
                  }
                }}
              >
                <span className="material-icons mr-1">delete</span>
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
function ShareTimelineButton(props: {
  timelineConfig: CustomTimelineType;
  egoIdentifier: string;
}) {
  const { timelineConfig, egoIdentifier } = props;
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => {
        setCopied(false);
      }, 2000);
      return () => {
        clearTimeout(timeout);
      };
    }
  }, [copied]);

  return (
    <button
      className={
        "h-6 px-1 border rounded flex flex-row items-center justify-center dark:bg-green-700 dark:border-green-600 dark:text-green-100 bg-green-300 border-green-400 " +
        (loading ? "opacity-60 cursor-default" : "")
      }
      onClick={async () => {
        if (loading) return;
        setLoading(true);
        const response = await fetch("/api/shared_custom_timeline", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            config: timelineConfig,
            created_by_handle: egoIdentifier,
          }),
        })
          .then((res) => {
            if (res.ok) {
              res.json().then((data) => {
                // copy link to clipboard
                navigator.clipboard.writeText(
                  `${window.location.origin}/?addSharedTimeline=${data.key}`
                );

                setLoading(false);
                setCopied(true);
              });
            } else {
              throw new Error(
                "Couldn't POST shared_custom_timeline: " + res.status
              );
            }
          })
          .catch((error) => {
            setLoading(false);
            throw error;
          });
      }}
    >
      {copied ? (
        <>
          <span className="material-icons mr-1">content_copy</span>
          Copied link!
        </>
      ) : (
        <>
          <span className="material-icons mr-1">share</span>
          Share timeline prompt
        </>
      )}
    </button>
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
    <div className="border-2 w-full sm:w-136 border-gray-300 bg-white dark:bg-slate-800 dark:border-slate-700 rounded-xl mb-8 overflow-hidden">
      {loading ? (
        <div className="flex flex-row justify-center items-center text-3xl py-32">
          <LoadingSpinner
            containerClassName="w-12 h-12 mr-4"
            dotClassName="bg-slate-800 dark:bg-slate-400"
          />
          <div className="text-slate-800 dark:text-slate-400">Loading...</div>
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
  const repostBy = post.repostBy;

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
        <div className="mt-0 mb-0 px-4 flex flex-row items-center text-sm mb-4 text-slate-700 dark:text-slate-300">
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
              : "border-b border-gray-300 dark:border-slate-700 ")
          }
        >
          {/* Reply / repost row */}
          {(record.reply || repostBy) && (
            <div
              className={
                "flex flex-row items-center text-sm pt-2 pb-2 -mt-4 text-slate-700 dark:text-slate-300 " +
                (record.reply
                  ? "border-t border-dashed border-slate-300 dark:border-slate-600 "
                  : "")
              }
            >
              {record.reply && (
                <>
                  <div className="material-icons mr-1">reply</div>
                  <div>Replied</div>
                </>
              )}
              {record.reply && repostBy && (
                <div className="ml-2 mr-1 border-l h-3 w-0 border-slate-600 dark:border-slate-400"></div>
              )}
              {repostBy && (
                <>
                  <div className="material-icons mr-1">repeat</div>
                  <div>Reposted by {repostBy.displayName}</div>
                </>
              )}
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
              <div className="text-slate-500 dark:text-slate-400">
                {author.handle ===
                "deepfates.com.deepfates.com.deepfates.com.deepfates.com.deepfates.com"
                  ? "i'm an asshole 💩"
                  : "@" + author.handle}
              </div>
            </div>
            {/* timestamp */}
            <div className="flex-grow text-right text-slate-500 dark:text-slate-400">
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
            <div className="mt-2 border border-slate-300 dark:border-slate-600 rounded-md p-2 py-2 text-sm">
              <div className="flex flex-row items-center h-4 text-slate-700 dark:text-slate-300 bg-green-4000 mb-1">
                <img
                  src={embed.record.author.avatar}
                  className="w-4 h-4 rounded-full mr-1"
                />
                <span className="font-semibold mr-1 leading-none">
                  {embed.record.author.displayName}
                </span>
                <span className="text-slate-500 dark:text-slate-400 leading-none">
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
          <div className="flex flex-row items-center text-base mt-3 text-slate-700 dark:text-slate-300 leading-none">
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

function Modal(props: { children: ReactNode; close: () => void }) {
  const { children, close } = props;
  return (
    <div
      className="fixed top-0 left-0 w-screen h-screen bg-black/50 backdrop-blur-md	flex justify-center items-center"
      onClick={() => close()}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-lg p-4 w-128 dark:border-2 dark:border-slate-600"
        onClick={(e) => e.stopPropagation()}
      >
        {props.children}
      </div>
    </div>
  );
}
function ConfigureTimelineModal(props: {
  customTimelines: CustomTimelinesType;
  setCustomTimelines: (timelines: CustomTimelinesType) => void;
  close: () => void;
  editingCustomAITimelineId: string | null;
}) {
  const {
    customTimelines,
    setCustomTimelines,
    close,
    editingCustomAITimelineId,
  } = props;
  const editingCustomAITimeline = editingCustomAITimelineId
    ? customTimelines[editingCustomAITimelineId]
    : null;
  const [name, setName] = useState(editingCustomAITimeline?.name || "");
  const [positivePrompt, setPositivePrompt] = useState(
    editingCustomAITimeline?.positivePrompt || ""
  );
  const [negativePrompt, setNegativePrompt] = useState(
    editingCustomAITimeline?.negativePrompt || ""
  );

  return (
    <Modal close={close}>
      <div className="text-xl font-bold mb-4">
        {editingCustomAITimeline
          ? `Edit "${editingCustomAITimeline.name}" timeline`
          : "Create a timeline"}
      </div>
      <div className="flex flex-col gap-2">
        <label>Title</label>
        <input
          type="text"
          placeholder="Wholesome TL"
          className="border border-gray-300 dark:border-slate-700 rounded-md p-2 w-1/2 text-black"
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
          className="border border-gray-300 dark:border-slate-700 rounded-md p-2 text-black"
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
          className="border border-gray-300 dark:border-slate-700 rounded-md p-2 text-black"
          value={negativePrompt}
          onChange={(e) => setNegativePrompt(e.target.value)}
        />
        <button
          className="bg-blue-500 text-white rounded-md p-2 w-1/3 mt-4 ml-auto"
          onClick={() => {
            setCustomTimelines({
              ...customTimelines,
              [editingCustomAITimelineId || Date.now().toString()]: {
                name: name.trim(),
                positivePrompt: positivePrompt.trim(),
                negativePrompt: negativePrompt.trim(),
              },
            });
            close();
          }}
        >
          {editingCustomAITimeline ? "Save" : "Create"}
        </button>
      </div>
    </Modal>
  );
}

// LOGIN SCREEN
function LoginScreen(props: {
  setLoginResponseData: (data: LoginResponseDataType | null) => void;
  agent: BskyAgent;
}) {
  const { setLoginResponseData, agent } = props;
  const login = (username: string, password: string) => {
    setError(null);
    agent
      .login({
        identifier: username,
        password: password,
      })
      .then((response) => {
        if (response.success) {
          setLoginResponseData({
            ...response.data,
            refreshJwt: "", // removing this for security reasons
          });
        } else {
          // Error
          setLoginResponseData(null);
          setError("Error");
        }
      })
      .catch((err) => {
        // Error
        setLoginResponseData(null);
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
          className="border border-gray-300 dark:border-slate-700 p-2 rounded mb-4 text-black"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border border-gray-300 dark:border-slate-700 p-2 rounded mb-4 text-black"
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
    <div className="mt-32 max-w-sm bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-300 dark:border-slate-600 rounded-xl mb-8">
      <div className="flex flex-row pb-2 border-b border-slate-300 dark:border-slate-600 mb-2">
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
  // Bluesky API
  const agent = useRef<BskyAgent>(
    new BskyAgent({
      service: "https://bsky.social",
    })
  ).current;

  // Auth stuff
  const [loginResponseData, setLoginResponseData] =
    useLocalStorageState<LoginResponseDataType | null>(
      "@loginResponseData",
      null
    );
  const identifier = loginResponseData?.handle;
  const accessJwt = !!loginResponseData?.accessJwt
    ? (jwt.decode(loginResponseData.accessJwt) as {
        exp: number;
        iat: number;
        scope: string;
        sub: string;
      })
    : null;
  const loginExpiration = accessJwt?.exp;
  const timeUntilLoginExpire = loginExpiration
    ? loginExpiration * 1000 - Date.now()
    : null;
  useEffect(() => {
    if (timeUntilLoginExpire) {
      const timeout = setTimeout(() => {
        setLoginResponseData(null);
      }, Math.max(timeUntilLoginExpire, 0));

      return () => clearTimeout(timeout);
    }
  }, [timeUntilLoginExpire]);
  useEffect(() => {
    if (loginResponseData && !agent.session) {
      agent.resumeSession(loginResponseData);
    }
  }, [loginResponseData]);

  // Styling for body
  useEffect(() => {
    const className = "bg-slate-50 dark:bg-slate-900";
    className.split(" ").forEach((name) => document.body.classList.add(name));

    return () => {
      className
        .split(" ")
        .forEach((name) => document.body.classList.remove(name));
    };
  }, []);

  // Custom Timelines Installed
  const [customTimelines, setCustomTimelines] =
    useLocalStorageState<CustomTimelinesType>("@customAITimelines", {});

  const router = useRouter();
  useEffect(() => {
    if (router.query.addSharedTimeline) {
      fetch(
        `/api/shared_custom_timeline?key=${router.query.addSharedTimeline}`
      ).then((res) => {
        if (res.ok) {
          res.json().then((json) => {
            router.replace("/", undefined, {
              scroll: false,
              shallow: true,
            });
            setCustomTimelines({
              ...customTimelines,
              [Date.now().toString()]: {
                ...json.config,
                sharedBy: json.created_by_handle,
              },
            });
          });
        } else {
          throw Error("Couldn't GET shared_ai_timeline: " + res.statusText);
        }
      });
    }
  }, [router.query.addSharedTimeline]);

  return (
    <>
      <Head>
        <title>Skyline</title>
        <link rel="icon" href="/skyline-16.png" />
      </Head>
      <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-900 dark:text-slate-100">
        {identifier ? (
          <TimelineScreen
            setLoginResponseData={setLoginResponseData}
            egoIdentifier={identifier}
            agent={agent}
            customTimelines={customTimelines}
            setCustomTimelines={setCustomTimelines}
          />
        ) : (
          <LoginScreen
            setLoginResponseData={setLoginResponseData}
            agent={agent}
          />
        )}
      </div>
    </>
  );
}
