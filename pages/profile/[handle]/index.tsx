import { BORDER_200, BORDER_300 } from "@/helpers/styling";
import { BskyAgent, RichText } from "@atproto/api";
import { ProfileViewDetailed } from "@atproto/api/dist/client/types/app/bsky/actor/defs";
import { FeedViewPost } from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

function RichTextReact(props: { agent: BskyAgent; text: string }) {
  const { agent, text } = props;
  const [markdown, setMarkdown] = useState(text);

  useEffect(() => {
    (async () => {
      const rt = new RichText({
        text,
      });
      await rt.detectFacets(agent); // automatically detects mentions and links

      let newMarkdown = "";

      // @ts-expect-error
      for (const segment of rt.segments()) {
        if (segment.isLink()) {
          newMarkdown += `[${segment.text}](${segment.link?.uri})`;
        } else if (segment.isMention()) {
          newMarkdown += `[${segment.text}](${window?.location?.host}/profile/${segment.mention?.handle})`;
        } else {
          newMarkdown += segment.text;
        }
      }

      setMarkdown(newMarkdown);
    })();
  }, [text]);

  return (
    <ReactMarkdown className="prose prose-slate dark:prose-invert">
      {markdown}
    </ReactMarkdown>
  );
}

// TIMELINE SCREEN
export type ProfileScreenProps = {
  agent: BskyAgent;
  egoHandle: string;
};
export default function ProfileScreen(props: ProfileScreenProps) {
  const { agent, egoHandle } = props;
  const router = useRouter();
  const handle = router.query.handle as string;

  const [loading, setLoading] = useState(false);
  console.log(handle);

  const [profile, setProfile] = useState<ProfileViewDetailed | null>(null);
  const [posts, setPosts] = useState<FeedViewPost[]>([]);
  const [postsCursor, setPostsCursor] = useState<string | undefined>();

  const loadProfile = async () => {
    if (loading) return;
    if (handle) {
      setLoading(true);
      const result = await agent.getProfile({
        actor: "louis02x.com",
      });
      setProfile(result.data);
      setLoading(false);
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
      setPosts(posts.concat(result.data.feed));
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [handle]);

  const views = [
    ["posts", "Posts"],
    ["replies", "Posts & Replies"],
    // ["media", "Media"],
    // ["likes", "Likes"],
  ];
  const [selectedView, setSelectedView] = useState<string>("posts");

  return (
    <div
      className={
        "border-2 w-full sm:w-136 bg-white dark:bg-slate-800 rounded-xl mb-8 overflow-hidden " +
        BORDER_300
      }
    >
      {profile && (
        <>
          <div
            className="w-full "
            style={{
              aspectRatio: 4,
              backgroundImage: `url(${profile.banner})`,
              backgroundSize: "cover",
            }}
          />
          <div className={"flex flex-col px-2 border-b-2 mb-8 " + BORDER_200}>
            <div className="w-20 h-20 bg-white dark:bg-black rounded-full -mt-12 p-0.5">
              <img
                src={profile.avatar}
                className="w-full h-full rounded-full"
              />
            </div>
            <h3 className="text-2xl">{profile.displayName}</h3>
            <h6 className="text-base text-slate-500 dark:text-slate-400 mb-2">
              @{profile.handle}
            </h6>
            <div className="flex flex-row mb-1">
              <Stat count={profile.followersCount || 0} label="followers" />
              <Stat count={profile.followsCount || 0} label="following" />
              <Stat count={profile.postsCount || 0} label="posts" />
            </div>
            <div className="mb-2">
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
        </>
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
