import { LoadingPlaceholder } from "@/components/LoadingSpinner";
import Post from "@/components/Post";
import RichTextReact from "@/components/RichTextReact";
import {
  feedViewPostToSkylinePost,
  mergeConversationsInstant,
} from "@/helpers/bsky";
import { SkylinePostType } from "@/helpers/contentTypes";
import { BORDER_200, BORDER_300 } from "@/helpers/styling";
import { BskyAgent } from "@atproto/api";
import { ProfileViewDetailed } from "@atproto/api/dist/client/types/app/bsky/actor/defs";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

// TIMELINE SCREEN
export type ProfileScreenProps = {
  agent: BskyAgent;
  egoHandle: string;
  egoDid: string;
};
export default function ProfileScreen(props: ProfileScreenProps) {
  const { agent, egoHandle, egoDid } = props;
  const router = useRouter();
  const handle = router.query.handle as string;

  const views = [
    ["posts", "Posts"],
    ["replies", "Posts & Replies"],
    ["media", "Media"],
    // ["likes", "Likes"],
  ];
  const [selectedView, setSelectedView] = useState<string>("posts");

  const [loading, setLoading] = useState(false);
  console.log(handle);

  const [profile, setProfile] = useState<ProfileViewDetailed | null>(null);
  const [isFollowing, setIsFollowing] = useState<string | false | null>(null);
  const [posts_, setPosts] = useState<SkylinePostType[]>([]);
  const posts =
    selectedView === "media" ? posts_ : mergeConversationsInstant(posts_);
  const [postsCursor, setPostsCursor] = useState<string | undefined>();

  const loadProfile = async () => {
    if (handle) {
      const result = await agent.getProfile({
        actor: handle,
      });
      setProfile(result.data);
      setIsFollowing(result.data.viewer?.following || false);
    }
  };

  const loadPosts = async () => {
    if (loading) return;
    if (handle) {
      setLoading(true);
      const result = await agent.getAuthorFeed({
        actor: handle,
        cursor: postsCursor,
      });
      setPostsCursor(result.data.cursor);
      setPosts(posts.concat(result.data.feed.map(feedViewPostToSkylinePost)));
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    loadPosts();
  }, [handle]);

  const [postingFollow, setPostingFollow] = useState<boolean>(false);

  return (
    <div
      className={
        "border-2 w-full sm:w-136 bg-white dark:bg-slate-800 rounded-xl mb-8 overflow-hidden " +
        BORDER_300
      }
    >
      {profile ? (
        <>
          {profile.banner ? (
            <div
              className="w-full "
              style={{
                aspectRatio: 4,
                backgroundImage: `url(${profile.banner})`,
                backgroundSize: "cover",
              }}
            />
          ) : (
            <div
              className="w-full bg-blue-900"
              style={{
                aspectRatio: 4,
              }}
            />
          )}
          <div className={"flex flex-col px-2 border-b-2 " + BORDER_200}>
            <div className="flex flex-row">
              <div className="flex flex-col flex-1">
                <div className="w-20 h-20 bg-white dark:bg-black rounded-full -mt-12 p-0.5">
                  <img
                    src={profile.avatar}
                    className="w-full h-full rounded-full"
                  />
                </div>
                <h3 className="text-2xl">{profile.displayName}</h3>
                <h6 className="text-base text-slate-500 dark:text-slate-400 mb-2 flex flex-row items-center">
                  @{profile.handle}{" "}
                  {!!profile.viewer?.followedBy && (
                    <span className="text-xs pb-1 pt-1.5 px-1.5 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-md ml-1 unselectable flex flex-row items-center leading-none">
                      FOLLOWS YOU
                    </span>
                  )}
                </h6>
              </div>
              {profile.did !== egoDid && (
                <button
                  className={
                    "flex flex-row items-center justify-center w-32 h-8 mt-3 rounded-md pr-1 text-base " +
                    (isFollowing
                      ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white " +
                        BORDER_300
                      : "bg-blue-500 text-white ") +
                    (postingFollow ? "opacity-50" : "")
                  }
                  onClick={() => {
                    if (!postingFollow) {
                      if (isFollowing) {
                        setPostingFollow(true);
                        agent
                          .deleteFollow(isFollowing)
                          .then(() => {
                            setIsFollowing(false);
                            setPostingFollow(false);
                          })
                          .catch(() => setPostingFollow(false));
                      } else {
                        setPostingFollow(true);
                        agent
                          .follow(profile.did)
                          .then((result) => {
                            setIsFollowing(result.uri);
                            setPostingFollow(false);
                          })
                          .catch(() => setPostingFollow(false));
                      }
                    }
                  }}
                >
                  <span className="material-icons text-xl mr-1">
                    {isFollowing ? "check" : "add"}
                  </span>
                  {isFollowing ? "Following" : "Follow"}
                </button>
              )}
            </div>
            <div className="flex flex-row mb-1">
              <Stat count={profile.followersCount || 0} label="followers" />
              <Stat count={profile.followsCount || 0} label="following" />
              <Stat count={profile.postsCount || 0} label="posts" />
            </div>
            <div className="mb-2 dark:text-slate-300 text-slate-600">
              <RichTextReact agent={agent} text={profile.description || ""} />
            </div>
            {/* TABS */}
            <div className="flex flex-row">
              {views.map(([id, label]) => {
                return (
                  <button
                    className={
                      "outline-none bg-transparent px-2 py-1 border-b-2 mr-4 " +
                      (id === selectedView
                        ? "border-slate-600 dark:border-slate-300 "
                        : "border-transparent dark:border-transparent ")
                    }
                    onClick={() => {
                      setSelectedView(id);
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            {posts
              .filter((post) => {
                if (selectedView === "replies") return true;
                else if (selectedView === "media")
                  return (
                    // @ts-expect-error
                    (post.postView.embed?.images?.length ||
                      // @ts-expect-error
                      post.postView.embed?.media?.images?.length) &&
                    !post.repostBy
                  );
                else if (selectedView === "posts")
                  return (
                    !post.postView.record.reply ||
                    post.replyingTo?.[0]?.postView.author.handle === handle
                  );
              })
              .map((post) => (
                <Post agent={agent} post={post} />
              ))}
          </div>
        </>
      ) : (
        <LoadingPlaceholder />
      )}
    </div>
  );
}

function Stat(props: { count: number; label: string }) {
  const { count, label } = props;
  return (
    <div className="">
      <span className="text-black dark:text-white mr-1 text-base">{count}</span>
      <span className="text-slate-500 dark:text-slate-400 mr-3 text-base">
        {label}
      </span>
    </div>
  );
}
