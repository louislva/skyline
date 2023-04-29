import LoadingSpinner from "@/components/LoadingSpinner";
import {
  LoginResponseDataType,
  mergeConversationsContinual,
} from "@/helpers/bsky";
import { LanguageType } from "@/helpers/classifyLanguage";
import { RecordType, SkylinePostType } from "@/helpers/contentTypes";
import { useLocalStorageState } from "@/helpers/hooks";
import {
  ProduceFeedOutput,
  TimelineDefinitionType,
  makeOneFromEachFeed,
  makePrincipledFeed,
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
type CustomAITimelineType = {
  name: string;
  positivePrompt: string;
  negativePrompt: string;
  sharedBy?: string;
};
type CustomAITimelinesType = {
  [id: string]: CustomAITimelineType;
};
type TimelineIdType = string;

// TIMELINE SCREEN
function TimelineScreen(props: {
  setLoginResponseData: (value: LoginResponseDataType | null) => void;
  egoIdentifier: string;
  agent: BskyAgent;
  customTimelines: CustomAITimelinesType;
  setCustomTimelines: (value: CustomAITimelinesType) => void;
}) {
  const {
    setLoginResponseData,
    egoIdentifier,
    agent,
    customTimelines,
    setCustomTimelines,
  } = props;

  const [language, setLanguage] = useLocalStorageState<LanguageType>(
    "@language",
    "english"
  );

  const timelines = useMemo(() => {
    const TIMELINES: TimelinesType = {
      following: makePrincipledFeed(
        {
          icon: "person_add",
          name: "Following",
          description:
            "Posts from people you follow, in reverse chronological order",
        },
        {
          baseFeed: "following",
          mutualsOnly: false,
          replies: "all",
          sorting: "time",
        }
      ),
      whatsHot: makePrincipledFeed(
        {
          icon: "trending_up",
          name: `What's Hot (${
            {
              english: "English",
              portuguese: "Português",
              farsi: "فارسی",
              japanese: "日本語",
            }[language]
          })`,
          description:
            "What's Hot feed, filtered to show only your preferred language",
        },
        {
          baseFeed: "popular",
          mutualsOnly: false,
          replies: "all",
          language,
          sorting: "time",
        }
      ),
      "one-from-each": makeOneFromEachFeed(),
      mutuals: makePrincipledFeed(
        {
          icon: "people",
          name: "Mutuals",
          description: "Posts from your friends",
        },
        {
          baseFeed: "following",
          mutualsOnly: true,
          replies: "all",
          sorting: "time",
        }
      ),
      wholesome: makePrincipledFeed(
        {
          icon: "favorite",
          name: "Wholesome",
          description:
            "AI-feed boosting wholesome tweets, and removing angry / political / culture war tweets",
        },
        {
          baseFeed: "following",
          mutualsOnly: false,
          replies: "all",
          positivePrompts: ["Wholesome tweet, kindness, love, fun banter"],
          negativePrompts: [
            "Angry tweets, with politics, people talking about gender & dating, etc.",
          ],
          sorting: "combo",
        }
      ),
    };

    return {
      ...TIMELINES,
      ...Object.fromEntries(
        Object.entries(customTimelines).map(([id, config]) => {
          const { name, positivePrompt, negativePrompt, sharedBy } = config;
          return [
            id,
            {
              ...makePrincipledFeed(
                {
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
                {
                  baseFeed: "following",
                  mutualsOnly: false,
                  positivePrompts: positivePrompt.trim()
                    ? [positivePrompt]
                    : undefined,
                  negativePrompts: negativePrompt.trim()
                    ? [negativePrompt]
                    : undefined,
                  sorting: "combo",
                }
              ),
            },
          ] as [string, TimelineDefinitionType];
        })
      ),
    };
  }, [customTimelines, language]);

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
        language={language}
        setLanguage={setLanguage}
      />
      <Timeline
        key={timelineId + "--" + language}
        timelineId={timelineId}
        agent={agent}
        egoIdentifier={egoIdentifier}
        timelines={timelines}
      />
      <TweetComposer agent={agent} />
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

function TweetComposer(props: { agent: BskyAgent }) {
  const { agent } = props;

  const [isComposerOpen, setIsComposerOpen] = useState<boolean>(false);
  const [draft, setDraft] = useState<string>("");
  const charactersLeft = 300 - draft.length;
  const postDisabled = !(charactersLeft >= 0 && draft.trim().length > 0);

  useEffect(() => {
    setDraft("");
  }, [isComposerOpen]);

  const submit = async () => {
    await agent.post({
      text: draft,
    });
    setIsComposerOpen(false);
  };

  return (
    <>
      <button
        className="fixed bottom-0 right-0 m-6 w-16 h-16 rounded-full flex items-center justify-center text-slate-50 bg-blue-500 border-2 border-blue-500 shadow-lg material-icons text-3xl unselectable outline-none"
        onClick={() => setIsComposerOpen(true)}
      >
        edit_note
      </button>
      {isComposerOpen && (
        <Modal
          close={() => {
            setIsComposerOpen(false);
          }}
        >
          <div className="flex flex-row justify-between items-center pb-3">
            <button
              className="material-icons text-2xl bg-transparent"
              onClick={() => setIsComposerOpen(false)}
            >
              close
            </button>
            <button
              disabled={postDisabled}
              className={
                "px-4 py-2 rounded-sm " +
                (!postDisabled
                  ? "text-white bg-blue-600 dark:bg-blue-700"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300")
              }
              onClick={async () => {
                if (!postDisabled) {
                  submit();
                }
              }}
            >
              Post
            </button>
          </div>
          {/* Q: what's better: textarea or a ContentEditable with a placeholder? */}
          {/* A: textarea, because it supports multiple lines */}
          <textarea
            className="w-full h-48 outline-none text-md p-4 outline-none rounded-md resize-none dark:bg-slate-900 bg-slate-200"
            autoFocus
            // since these are tweets: yes autocorrect, no autocapitalize
            autoCorrect="on"
            autoCapitalize="none"
            placeholder="What's happening?"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            // cmd / ctrl enter
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                if (!postDisabled) {
                  submit();
                }
              }
            }}
          ></textarea>
          {/* /300 counter */}
          <div className="flex flex-row justify-end pt-3 pr-3 pb-1">
            <span
              className={
                "text-base " +
                (charactersLeft < 0
                  ? "text-red-400"
                  : charactersLeft < 20
                  ? "text-yellow-400"
                  : "")
              }
            >
              {charactersLeft}
            </span>
          </div>
        </Modal>
      )}
    </>
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
              className="text-base border py-2 px-4 rounded-lg flex flex-row items-center ml-4 mr-0 sm:mr-3 text-slate-800 bg-white border-gray-300 dark:text-slate-50 dark:bg-slate-800 dark:border-slate-700 outline-none"
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
  customTimelines: CustomAITimelinesType;
  setCustomTimelines: (value: CustomAITimelinesType) => void;
  egoIdentifier: string;
  timelines: TimelinesType;
  language: LanguageType;
  setLanguage: (language: LanguageType) => void;
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
    language,
    setLanguage,
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
                className={`outline-none p-2 h-10 flex flex-row items-center border-slate-300 dark:border-slate-600 ${
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
          className="p-2 flex flex-row items-center justify-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md ml-0 lg:ml-2 mt-2 lg:mt-0 lg:w-8 h-8 px-2 lg:px-0 outline-none"
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
          {timelineId === "whatsHot" && (
            <div className="max-w-xl text-sm text-slate-800 dark:text-slate-400 mt-0 text-center pr-2">
              {["english", "portuguese", "japanese", "farsi"].map(
                (lang, index) => (
                  <div
                    className={
                      "pl-2 ml-2 leading-none border-slate-300 dark:border-slate-600 inline-block " +
                      (lang.toLowerCase() === language
                        ? "font-bold dark:font-normal dark:text-slate-50 underline"
                        : "") +
                      (index === 0 ? "" : " border-l")
                    }
                    key={index}
                    onClick={() => setLanguage(lang as LanguageType)}
                  >
                    {lang}
                  </div>
                )
              )}
            </div>
          )}
          {Object.keys(customTimelines).includes(timelineId) && (
            <>
              <ShareTimelineButton
                key={timelineId}
                timelineConfig={customTimelines[timelineId]}
                egoIdentifier={egoIdentifier}
              />
              <button
                className="h-6 px-1 border rounded flex flex-row items-center justify-center dark:bg-yellow-700 dark:border-yellow-600 dark:text-yellow-100 bg-yellow-300 border-yellow-400 outline-none"
                onClick={() => {
                  setEditingCustomAITimelineId(timelineId);
                }}
              >
                <span className="material-icons mr-1">edit</span>
                Edit
              </button>
              <button
                className="h-6 px-1 border rounded flex flex-row items-center justify-center dark:bg-red-700 dark:border-red-600 dark:text-red-100 bg-red-300 border-red-400 outline-none"
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
  timelineConfig: CustomAITimelineType;
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
        "h-6 px-1 border rounded flex flex-row items-center justify-center dark:bg-green-700 dark:border-green-600 dark:text-green-100 bg-green-300 border-green-400 outline-none " +
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
                  `${window.location.origin}/?tl=${data.key}`
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
  egoIdentifier: string;
  timelineId: TimelineIdType;
  timelines: TimelinesType;
}) {
  const { agent, egoIdentifier, timelineId, timelines } = props;

  const [loadedSegments, setLoadedSegments] = useState<
    (ProduceFeedOutput & {
      loadTimestamp: number;
    })[]
  >([]);
  // const [posts, setPosts] = useState<SkylinePostType[]>([]);
  const posts = useMemo(
    () => loadedSegments.flatMap((segment) => segment.posts),
    [loadedSegments]
  );
  const cursor = loadedSegments.slice(-1)?.[0]?.cursor;
  const [loading, setLoading] = useState<boolean>(false);

  const loadSegment = async (direction: "down" | "up" = "down") => {
    timelines[timelineId]
      .produceFeed({
        agent,
        egoIdentifier,
        cursor: direction === "down" ? cursor : undefined,
      })
      .then(async (result) => {
        const loadTimestamp = Date.now();
        if (direction === "up") {
          setLoadedSegments((oldLoadedSegments) => [
            {
              loadTimestamp,
              posts: [],
              cursor: result.cursor,
            },
            ...oldLoadedSegments,
          ]);
        } else {
          setLoadedSegments((oldLoadedSegments) => [
            ...oldLoadedSegments,
            {
              loadTimestamp,
              posts: [],
              cursor: result.cursor,
            },
          ]);
        }

        const postsSliced = result.posts;
        timelines[timelineId].postProcessFeed(
          {
            agent,
            egoIdentifier,
            posts: postsSliced,
          },
          (postsMerged) => {
            setLoadedSegments((oldLoadedSegments) => {
              const olderPostCids = oldLoadedSegments
                .filter(
                  (oldLoadedSegment) =>
                    oldLoadedSegment.loadTimestamp !== loadTimestamp
                )
                .flatMap((oldLoadedSegment) =>
                  oldLoadedSegment.posts.map((post) => post.postView.cid)
                );

              const postsMergedAndDeduplicated = postsMerged.filter(
                (post) => !olderPostCids.includes(post.postView.cid)
              );

              return oldLoadedSegments.map((oldLoadedSegment, index) =>
                oldLoadedSegment.loadTimestamp === loadTimestamp
                  ? {
                      ...oldLoadedSegment,
                      posts: postsMergedAndDeduplicated,
                    }
                  : oldLoadedSegment
              );
            });
            setLoading(false);
          }
        );
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    setLoadedSegments([]);
    setLoading(true);

    loadSegment();
  }, [timelineId]);

  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000 * 10);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="border-2 w-full sm:w-136 border-gray-300 bg-white dark:bg-slate-800 dark:border-slate-700 rounded-xl mb-8 overflow-hidden">
      {posts.length > 0 ? (
        <>
          {now - loadedSegments?.[0]?.loadTimestamp > 60000 ? (
            <button
              className={
                "w-full h-12 dark:bg-slate-700 bg-slate-100 text-base flex flex-row items-center justify-center unselectable outline-none " +
                (loading
                  ? "dark:text-slate-300 text-slate-500"
                  : "dark:text-slate-50 text-slate-800")
              }
              onClick={() => {
                if (!loading) {
                  setLoading(true);
                  loadSegment("up");
                }
              }}
            >
              {loading ? (
                <LoadingSpinner
                  containerClassName="w-6 h-6 mr-2"
                  dotClassName="bg-slate-800 dark:bg-slate-400"
                />
              ) : (
                <span className="material-icons text-2xl mr-2">
                  arrow_upward
                </span>
              )}
              Refresh feed
            </button>
          ) : null}
          {posts.map((post, index) => (
            <Post
              agent={agent}
              key={post.postView.cid + "index" + index}
              post={post}
              isLastPost={index === posts.length - 1}
            />
          ))}
          <button
            className={
              "w-full h-16 dark:bg-slate-700 bg-slate-100 text-base flex flex-row items-center justify-center unselectable outline-none " +
              (loading
                ? "dark:text-slate-300 text-slate-500"
                : "dark:text-slate-50 text-slate-800")
            }
            onClick={() => {
              if (!loading) {
                setLoading(true);
                loadSegment();
              }
            }}
          >
            {loading ? (
              <LoadingSpinner
                containerClassName="w-6 h-6 mr-2"
                dotClassName="bg-slate-800 dark:bg-slate-400"
              />
            ) : (
              <span className="material-icons text-2xl mr-2">add</span>
            )}
            Load more
          </button>
        </>
      ) : loading ? (
        <div className="flex flex-row justify-center items-center text-3xl py-32">
          <LoadingSpinner
            containerClassName="w-12 h-12 mr-4"
            dotClassName="bg-slate-800 dark:bg-slate-400"
          />
          <div className="text-slate-800 dark:text-slate-400">Loading...</div>
        </div>
      ) : (
        <div className="flex flex-col justify-center items-center py-32 text-slate-800 dark:text-slate-400">
          <div className="material-icons text-4xl mb-2">
            sentiment_dissatisfied
          </div>
          <div className="text-2xl">No posts in your timeline</div>
          <div className="text-lg mt-2 text-center">
            Try following some more accounts! We wholeheartedly recommend:{" "}
            <a
              href="https://staging.bsky.app/profile/louis02x.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 dark:text-blue-400"
            >
              @louis02x.com
            </a>{" "}
            (it's me lol)
          </div>
        </div>
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

  const [isLiked, setIsLiked] = useState<boolean>(!!post.postView.viewer?.like);
  const [likeUri, setLikeUri] = useState<string | null>(
    post.postView.viewer?.like || null
  );
  const likeDiff = (isLiked ? 1 : 0) - (post.postView.viewer?.like ? 1 : 0);

  const [isReposted, setIsReposted] = useState<boolean>(
    !!post.postView.viewer?.repost
  );
  const [repostUri, setRepostUri] = useState<string | null>(
    post.postView.viewer?.repost || null
  );
  const repostDiff =
    (isReposted ? 1 : 0) - (post.postView.viewer?.repost ? 1 : 0);

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
            <div className="rounded-full hover:bg-green-500/20 p-2 -m-2 flex justify-center items-center -mr-1">
              <div
                className={
                  "material-icons " +
                  (isReposted
                    ? "text-green-500"
                    : "text-slate-700 dark:text-slate-300")
                }
                style={{
                  paddingRight: 0.66 / 16 + "rem",
                }}
                onClick={async (e) => {
                  e.preventDefault();
                  setIsReposted(!isReposted);
                  if (!isReposted) {
                    const { uri } = await agent.repost(
                      post.postView.uri,
                      post.postView.cid
                    );
                    setRepostUri(uri);
                  } else {
                    if (repostUri) {
                      agent.deleteRepost(repostUri);
                    }
                    setRepostUri(null);
                  }
                }}
              >
                repeat
              </div>
            </div>
            <div className="mr-4">
              {(post.postView.repostCount || 0) + repostDiff}
            </div>
            <div className="rounded-full hover:bg-red-500/20 p-2 -m-2 flex justify-center items-center -mr-1">
              <div
                className={
                  "material-icons " +
                  (isLiked
                    ? "text-red-500"
                    : "text-slate-700 dark:text-slate-300")
                }
                style={{
                  paddingRight: 0.66 / 16 + "rem",
                }}
                onClick={async (e) => {
                  e.preventDefault();
                  setIsLiked(!isLiked);
                  if (!isLiked) {
                    const { uri } = await agent.like(
                      post.postView.uri,
                      post.postView.cid
                    );
                    setLikeUri(uri);
                  } else {
                    if (likeUri) {
                      agent.deleteLike(likeUri);
                    }
                    setLikeUri(null);
                  }
                }}
              >
                {isLiked ? "favorite" : "favorite_border"}
              </div>
            </div>
            <div className="mr-4">
              {(post.postView.likeCount || 0) + likeDiff}
            </div>
            {post.score && (
              <>
                {/* cog icon / settings icon bec it's a machine */}
                <div className="material-icons ml-auto mr-1 text-gray-400">
                  settings
                </div>
                <div className="text-gray-400">
                  {/* {(post.score * 100).toFixed(2)} */}
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
      className="fixed top-0 left-0 p-4 w-screen h-screen bg-black/50 backdrop-blur-md flex flex-row justify-center items-center"
      onClick={() => close()}
    >
      <div
        className="flex-1 rounded-lg p-4 max-w-lg dark:border-2 dark:border-slate-600 bg-white dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {props.children}
      </div>
    </div>
  );
}
function ConfigureTimelineModal(props: {
  customTimelines: CustomAITimelinesType;
  setCustomTimelines: (timelines: CustomAITimelinesType) => void;
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
          className="bg-blue-500 text-white rounded-md p-2 w-1/3 mt-4 ml-auto outline-none"
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
          login(username.replace("@", ""), password);
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
        <button
          type="submit"
          className="bg-blue-500 text-white p-2 rounded outline-none"
        >
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

type RefreshJwtType = {
  exp: number;
  iat: number;
  jti: string; // long random key
  scope: string; // "com.atproto.refresh"
  sub: string; // did
};
type AccessJwtType = {
  exp: number;
  iat: number;
  scope: string;
  sub: string;
};

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
  const egoIdentifier = loginResponseData?.handle;
  const accessJwt = !!loginResponseData?.accessJwt
    ? (jwt.decode(loginResponseData.accessJwt) as AccessJwtType)
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
  const [customAITimelines, setCustomAITimelines] =
    useLocalStorageState<CustomAITimelinesType>("@customAITimelines", {});

  const router = useRouter();
  useEffect(() => {
    if (router.query.tl) {
      fetch(`/api/shared_custom_timeline?key=${router.query.tl}`).then(
        (res) => {
          if (res.ok) {
            res.json().then((json) => {
              router.replace("/", undefined, {
                scroll: false,
                shallow: true,
              });
              setCustomAITimelines({
                ...customAITimelines,
                [Date.now().toString()]: {
                  ...json.config,
                  sharedBy: json.created_by_handle,
                },
              });
            });
          } else {
            throw Error("Couldn't GET shared_ai_timeline: " + res.statusText);
          }
        }
      );
    }
  }, [router.query.tl]);

  return (
    <>
      <Head>
        <title>Skyline</title>
        <link rel="icon" href="/skyline-16.png" />
      </Head>
      <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-900 dark:text-slate-100">
        {egoIdentifier ? (
          <TimelineScreen
            setLoginResponseData={setLoginResponseData}
            egoIdentifier={egoIdentifier}
            agent={agent}
            customTimelines={customAITimelines}
            setCustomTimelines={setCustomAITimelines}
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
