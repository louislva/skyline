import { RecordType, SkylinePostType } from "@/helpers/contentTypes";
import { BORDER_300 } from "@/helpers/styling";
import { BskyAgent } from "@atproto/api";
import { PostView } from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import moment from "moment";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import RichTextReact from "./RichTextReact";
import { useRouter } from "next/router";
import { useControllerContext } from "./ControllerContext";

type ImageType = {
  alt: string;
  fullsize: string;
  thumb: string;
};

type EmbedType = {
  $type: "app.bsky.embed.record#view" | "app.bsky.embed.images" | string;
  images?: ImageType[] | undefined;
  media?:
    | {
        images?: ImageType[];
      }
    | undefined;
  record?: {
    author: PostView["author"];
    value: RecordType;
    cid: string;
    uri: string;
  };
};

export default function Post(props: {
  agent: BskyAgent;
  post: SkylinePostType;
  hasChildren?: boolean;
  isLastPostInFeed?: boolean;
  isSub?: boolean;
  isStandAlone?: boolean;
  isFirstPostInThread?: boolean;
}) {
  const { agent, post, hasChildren, isLastPostInFeed, isSub, isStandAlone } =
    props;

  const author = post.postView.author;
  const embed: EmbedType | undefined = post.postView.embed as any;
  const images = (embed?.images || []).concat(embed?.media?.images || []);
  const record: RecordType = post.postView.record as any;

  const ancestorPosts: SkylinePostType[] = post.replyingTo || [];
  const isFirstPostInThread =
    !!props.isFirstPostInThread || (!isSub && ancestorPosts.length === 0);

  const [isLiked, setIsLiked] = useState<boolean>(!!post.postView.viewer?.like);
  const [likeUri, setLikeUri] = useState<string | null>(
    post.postView.viewer?.like || null
  );
  const likeDiff = (isLiked ? 1 : 0) - (post.postView.viewer?.like ? 1 : 0);
  const toggleLiked = async () => {
    setIsLiked(!isLiked);
    if (!isLiked) {
      const { uri } = await agent.like(post.postView.uri, post.postView.cid);
      setLikeUri(uri);
    } else {
      if (likeUri) {
        agent.deleteLike(likeUri);
      }
      setLikeUri(null);
    }
  };

  const [isReposted, setIsReposted] = useState<boolean>(
    !!post.postView.viewer?.repost
  );
  const [repostUri, setRepostUri] = useState<string | null>(
    post.postView.viewer?.repost || null
  );
  const repostDiff =
    (isReposted ? 1 : 0) - (post.postView.viewer?.repost ? 1 : 0);
  const toggleReposted = async () => {
    setIsReposted(!isReposted);
    if (!isReposted) {
      const { uri } = await agent.repost(post.postView.uri, post.postView.cid);
      setRepostUri(uri);
    } else {
      if (repostUri) {
        agent.deleteRepost(repostUri);
      }
      setRepostUri(null);
    }
  };

  const { setComposingPost } = useControllerContext();
  const quoteTweet = () => {
    setComposingPost({
      text: "",
      quotePost: post,
    });
  };

  return (
    <>
      {/* Show all replies, if isStandAlone */}
      {isStandAlone ? (
        ancestorPosts.map((reply, index) => (
          <Post
            key={reply.postView.cid + "as child to" + post.postView.cid}
            agent={agent}
            post={reply}
            isFirstPostInThread={index === 0}
            hasChildren
            isSub
          />
        ))
      ) : (
        <>
          {ancestorPosts.slice(0, 1).map((reply) => (
            <Post
              key={reply.postView.cid + "as child to" + post.postView.cid}
              agent={agent}
              post={reply}
              isFirstPostInThread
              hasChildren
              isSub
            />
          ))}
          {ancestorPosts.length > 2 && (
            <div className="px-4 flex flex-row items-center text-sm my-3 text-slate-700 dark:text-slate-300">
              <div className="text-xl mr-1 -mt-2">...</div>
              {ancestorPosts.length - 2} more replies{" "}
              <div className="text-xl ml-1 -mt-2">...</div>
            </div>
          )}
          {ancestorPosts.length > 1 &&
            ancestorPosts
              .slice(-1)
              .map((reply) => (
                <Post
                  key={
                    reply.postView.cid +
                    "as a later child to" +
                    post.postView.cid
                  }
                  agent={agent}
                  post={reply}
                  hasChildren
                  isSub
                />
              ))}
        </>
      )}
      {isStandAlone ? (
        <ContentStandalone
          agent={agent}
          ancestorPosts={ancestorPosts}
          post={post}
          author={author}
          record={record}
          embed={embed}
          images={images}
          // Likes
          isLiked={isLiked}
          toggleLiked={toggleLiked}
          likeCount={(post.postView.likeCount || 0) + likeDiff}
          // Reposts
          isReposted={isReposted}
          toggleReposted={toggleReposted}
          quoteTweet={quoteTweet}
          repostCount={(post.postView.repostCount || 0) + repostDiff}
          // Other
          isSub={!!isSub}
          isLastPostInFeed={!!isLastPostInFeed}
          isFirstPostInThread={isFirstPostInThread}
          isLastPostInThread={!hasChildren}
        />
      ) : (
        <ContentInline
          agent={agent}
          ancestorPosts={ancestorPosts}
          post={post}
          author={author}
          record={record}
          embed={embed}
          images={images}
          // Likes
          isLiked={isLiked}
          toggleLiked={toggleLiked}
          likeCount={(post.postView.likeCount || 0) + likeDiff}
          // Reposts
          isReposted={isReposted}
          toggleReposted={toggleReposted}
          quoteTweet={quoteTweet}
          repostCount={(post.postView.repostCount || 0) + repostDiff}
          // Other
          isSub={!!isSub}
          isLastPostInFeed={!!isLastPostInFeed}
          isFirstPostInThread={isFirstPostInThread}
          isLastPostInThread={!hasChildren}
        />
      )}
    </>
  );
}

function ContentStandalone(props: {
  agent: BskyAgent;

  ancestorPosts: SkylinePostType[];
  post: SkylinePostType;
  author: PostView["author"];
  record: RecordType;
  embed: EmbedType | undefined;
  images: ImageType[];

  isLiked: boolean;
  toggleLiked: () => void;
  likeCount: number;

  isReposted: boolean;
  toggleReposted: () => void;
  quoteTweet: () => void;
  repostCount: number;

  isSub: boolean; // If we're not at the root level
  isLastPostInThread: boolean;
  isFirstPostInThread: boolean;
  isLastPostInFeed: boolean;
}) {
  const {
    agent,

    ancestorPosts,
    post,
    author,
    record,
    embed,
    images,

    isLiked,
    toggleLiked,
    likeCount,

    isReposted,
    toggleReposted,
    quoteTweet,
    repostCount,

    isSub,
    isFirstPostInThread,
    isLastPostInThread,
    isLastPostInFeed,
  } = props;

  const repostBy = post.repostBy;

  const { setComposingPost } = useControllerContext();

  return (
    <div
      className={
        "p-4 overflow-hidden " +
        (!isFirstPostInThread ? "border-t " : "") +
        (!isLastPostInFeed ? "border-b " : "") +
        BORDER_300
      }
    >
      {/* Reply / repost row */}
      {(record.reply || repostBy) && (
        <div
          className={
            "flex flex-row items-center text-sm pt-2 pb-2 -mt-4 text-slate-700 dark:text-slate-300 "
          }
        >
          {repostBy && (
            <>
              <div className="material-icons mr-1">repeat</div>
              <div>
                Reposted by{" "}
                <Link
                  href={`/profile/${repostBy.handle}`}
                  className="hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {repostBy.displayName}
                </Link>
              </div>
            </>
          )}
        </div>
      )}

      {/* Profile row */}
      <div className="flex flex-row ">
        <Link
          href={`/profile/${author.handle}`}
          className="flex flex-row hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
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
        </Link>
        {/* timestamp */}
        <div className="flex-grow text-right text-slate-500 dark:text-slate-400">
          {moment(post.postView.indexedAt).fromNow()}
        </div>
      </div>
      {/* Content row */}
      <div className="mt-2">
        <RichTextReact agent={agent} text={record.text || ""} />
      </div>
      {/* Images */}
      {!!images?.length && (
        <div className="mt-2 flex flex-row h-72 gap-4">
          {images?.slice(0, 3).map((image) => (
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
      {embed?.record?.value && <QuotePost embed={embed} />}
      {/* Likes, RTs, etc. row */}
      <div className="flex flex-row items-center text-base mt-3 text-slate-700 dark:text-slate-300 leading-none">
        <ReplyButton
          replyCount={post.postView.replyCount || 0}
          post={post}
          ancestorPosts={ancestorPosts}
        />
        <RepostButton
          toggleReposted={toggleReposted}
          quoteTweet={quoteTweet}
          isReposted={isReposted}
          repostCount={repostCount}
        />
        <LikeButton
          toggleLiked={toggleLiked}
          isLiked={isLiked}
          likeCount={likeCount}
        />
        {post.score && (
          <>
            {/* cog icon / settings icon bec it's a machine */}
            <div className="material-icons ml-auto mr-1 text-slate-400">
              settings
            </div>
            <div className="text-slate-400">
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
  );
}

function ContentInline(props: {
  agent: BskyAgent;

  ancestorPosts: SkylinePostType[];
  post: SkylinePostType;
  author: PostView["author"];
  record: RecordType;
  embed: EmbedType | undefined;
  images: ImageType[];

  isLiked: boolean;
  toggleLiked: () => void;
  likeCount: number;

  isReposted: boolean;
  toggleReposted: () => void;
  quoteTweet: () => void;
  repostCount: number;

  isSub: boolean; // If we're not at the root level
  isLastPostInThread: boolean;
  isFirstPostInThread: boolean;
  isLastPostInFeed: boolean;
}) {
  const {
    agent,

    ancestorPosts,
    post,
    author,
    record,
    embed,
    images,

    isLiked,
    toggleLiked,
    likeCount,

    isReposted,
    toggleReposted,
    quoteTweet,
    repostCount,

    isSub,
    isFirstPostInThread,
    isLastPostInThread,
    isLastPostInFeed,
  } = props;

  const repostBy = post.repostBy;

  const profileLink = `/profile/${author.handle}`;
  const postLink = `/profile/${author.handle}/post/${
    post.postView.uri?.split("/")?.slice(-1)?.[0]
  }`;

  const router = useRouter();

  return (
    <div
      className={
        "p-4 overflow-hidden flex flex-row " +
        (!isLastPostInThread || isLastPostInFeed
          ? "border-none "
          : "border-b " + BORDER_300)
      }
      onClick={async (e) => {
        router.push(postLink);
      }}
    >
      {/* Profile Column */}
      <div className="flex flex-col w-12 items-center">
        {/* Pfp */}
        {!isFirstPostInThread && (
          <div className="absolute -mt-4 w-0.5 h-2 flex-1 bg-slate-300 dark:bg-slate-500"></div>
        )}
        {author.avatar && (
          <Link
            href={profileLink}
            className="w-12 h-12 rounded-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={author.avatar} alt={author.name + "'s avatar"} />
          </Link>
        )}
        {!isLastPostInThread && (
          <div
            className={
              "w-0.5 flex-1 bg-slate-300 dark:bg-slate-500 " +
              (isLastPostInThread ? "mt-2 -mb-0" : "mt-2 -mb-4")
            }
          />
        )}
      </div>
      {/* Content Column */}
      <div className="relative flex flex-col flex-1 pl-3">
        {/* Reply / repost row */}
        {repostBy && (
          <div
            className={
              "flex flex-row items-center text-sm pt-2 pb-2 -mt-4 text-slate-700 dark:text-slate-300 " +
              (record.reply && (ancestorPosts.length || isSub)
                ? "border-t border-dashed " + BORDER_300
                : "")
            }
          >
            {repostBy && (
              <>
                <div className="material-icons mr-1">repeat</div>
                <div>
                  Reposted by{" "}
                  <Link
                    href={`/profile/${repostBy.handle}`}
                    className="hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {repostBy.displayName}
                  </Link>
                </div>
              </>
            )}
          </div>
        )}
        {/* Profile row */}
        <div className="flex flex-row leading-tight">
          <Link
            href={profileLink}
            className="flex-1 flex flex-row flex-wrap hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Name / handle */}
            <div className="font-semibold mr-1.5">{author.displayName}</div>
            <div className="text-slate-500 dark:text-slate-400">
              {author.handle ===
              "deepfates.com.deepfates.com.deepfates.com.deepfates.com.deepfates.com"
                ? "i'm an asshole 💩"
                : "@" + author.handle}
            </div>
          </Link>
          {/* timestamp */}
          <div className="text-slate-500 dark:text-slate-400">
            {moment(post.postView.indexedAt).fromNow()}
          </div>
        </div>
        {/* Content row */}
        <div className="mt-2 break-words">
          <RichTextReact agent={agent} text={record.text || ""} />
        </div>
        {/* Images */}
        {!!images?.length && (
          <div className="mt-2 flex flex-row h-72 gap-4">
            {images?.slice(0, 3).map((image) => (
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
        {embed?.record?.value && <QuotePost embed={embed} />}
        {/* Likes, RTs, etc. row */}
        <div className="flex flex-row items-center text-base mt-3 text-slate-700 dark:text-slate-300 leading-none">
          <ReplyButton
            replyCount={post.postView.replyCount || 0}
            post={post}
            ancestorPosts={ancestorPosts}
          />
          <RepostButton
            toggleReposted={toggleReposted}
            quoteTweet={quoteTweet}
            isReposted={isReposted}
            repostCount={repostCount}
          />
          <LikeButton
            toggleLiked={toggleLiked}
            isLiked={isLiked}
            likeCount={likeCount}
          />
          {post.score && (
            <>
              {/* cog icon / settings icon bec it's a machine */}
              <div className="material-icons ml-auto mr-1 text-slate-400">
                settings
              </div>
              <div className="text-slate-400">
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
    </div>
  );
}

export function QuotePost(props: { embed: EmbedType; linkDisabled?: boolean }) {
  const { record } = props.embed;
  const { linkDisabled } = props;
  const link = `/profile/${record?.author.handle}/post/${
    record?.uri?.split("/")?.slice(-1)?.[0]
  }`;

  const body = (
    <div className={"mt-2 border rounded-md p-2 py-2 text-sm " + BORDER_300}>
      <div className="flex flex-row items-center h-4 text-slate-700 dark:text-slate-300 bg-green-4000 mb-1">
        <img
          src={record?.author.avatar}
          className="w-4 h-4 rounded-full mr-1"
        />
        <span className="font-semibold mr-1 leading-none">
          {record?.author.displayName}
        </span>
        <span className="text-slate-500 dark:text-slate-400 leading-none">
          @{record?.author.handle}
        </span>
      </div>
      <div className="bg-blue-4000">
        {record?.value?.text?.split("\n").map((line, index) => (
          <Fragment key={line + "$" + index}>
            {index !== 0 && <br />}
            {line}
          </Fragment>
        ))}
      </div>
    </div>
  );

  return linkDisabled ? body : <Link href={link}>{body}</Link>;
}

function ReplyButton(props: {
  replyCount: number;
  post: SkylinePostType;
  ancestorPosts: SkylinePostType[];
}) {
  const { replyCount, post, ancestorPosts } = props;
  const { setComposingPost } = useControllerContext();

  return (
    <>
      <button
        className="rounded-full hover:bg-amber-500/20 p-2 -m-2 flex justify-center items-center -mr-1"
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          setComposingPost({
            replyingTo: {
              parent: post.postView,
              root: ancestorPosts.concat([post])[0]?.postView,
            },
            text: "",
          });
        }}
      >
        <div className="material-icons text-slate-700 dark:text-slate-300">
          chat_bubble_outline
        </div>
      </button>
      <div className="mr-4">{replyCount}</div>
    </>
  );
}
function RepostButton(props: {
  toggleReposted: () => void;
  quoteTweet: () => void;
  isReposted: boolean;
  repostCount: number;
}) {
  const { isReposted, quoteTweet, toggleReposted, repostCount } = props;
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    // if click anywhere on the page, this dropdown is closed
    const onBodyClick = () => {
      setDropdownOpen(false);
    };
    document.body.addEventListener("click", onBodyClick);
    return () => document.body.removeEventListener("click", onBodyClick);
  }, []);

  return (
    <>
      <div className="relative h-0">
        {dropdownOpen && (
          <div
            className={
              "absolute -mt-16 w-40 h-20 rounded-md bg-white dark:bg-slate-900 border-2 overflow-hidden z-40 flex flex-col items-stretch " +
              BORDER_300
            }
          >
            <button
              className="flex-1 hover:bg-black/10 dark:hover:bg-white/10 flex flex-row items-center justify-start text-left"
              onClick={toggleReposted}
            >
              <span className="material-icons px-3">repeat</span>Retweet
            </button>
            <button
              className="flex-1 hover:bg-black/10 dark:hover:bg-white/10 flex flex-row items-center justify-start text-left"
              onClick={quoteTweet}
            >
              <span className="material-icons px-3">edit_note</span>Quote tweet
            </button>
          </div>
        )}
      </div>
      <button
        className="rounded-full hover:bg-green-500/20 p-2 -m-2 flex justify-center items-center -mr-1"
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          setDropdownOpen(true);
        }}
      >
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
        >
          repeat
        </div>
      </button>
      <div className="mr-4">{repostCount}</div>
    </>
  );
}
function LikeButton(props: {
  toggleLiked: () => void;
  isLiked: boolean;
  likeCount: number;
}) {
  const { isLiked, toggleLiked, likeCount } = props;

  return (
    <>
      <button
        className="rounded-full hover:bg-red-500/20 p-2 -m-2 flex justify-center items-center -mr-1"
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleLiked();
        }}
      >
        <div
          className={
            "material-icons " +
            (isLiked ? "text-red-500" : "text-slate-700 dark:text-slate-300")
          }
          style={{
            paddingRight: 0.66 / 16 + "rem",
          }}
        >
          {isLiked ? "favorite" : "favorite_border"}
        </div>
      </button>
      <div className="mr-4">{likeCount}</div>
    </>
  );
}
