import { LoadingPlaceholder } from "@/components/LoadingSpinner";
import Post from "@/components/Post";
import {
  getThreadCacheFree,
  threadResponseToSkylinePost,
} from "@/helpers/bsky";
import { ExpandedPostView, SkylinePostType } from "@/helpers/contentTypes";
import { BORDER_300 } from "@/helpers/styling";
import { BskyAgent } from "@atproto/api";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

// TIMELINE SCREEN
export type ThreadScreenProps = {
  agent: BskyAgent;
  egoHandle: string;
  egoDid: string;
};

function useDidFromHandle(agent: BskyAgent, handle: string) {
  const [did, setDid] = useState<string | null>(null);

  useEffect(() => {
    if (handle && !handle.startsWith("did:")) {
      agent.resolveHandle({ handle }).then(({ data }) => setDid(data.did));
    }
  }, [handle]);

  return did;
}

export default function ThreadScreen(props: ThreadScreenProps) {
  const { agent, egoHandle, egoDid } = props;
  const router = useRouter();

  const handle = router.query.handle as string;
  const did = useDidFromHandle(agent, handle);
  const cid = router.query.cid as string;

  const [post, setPost] = useState<SkylinePostType | null>(null);
  const [replies, setReplies] = useState<SkylinePostType[] | null>(null);

  useEffect(() => {
    if (did && cid) {
      const uri = `at://${did}/app.bsky.feed.post/${cid}`;

      getThreadCacheFree(agent, uri).then((response) => {
        setPost(threadResponseToSkylinePost(response));
        setReplies(
          (response.data.thread.replies as { post: ExpandedPostView }[])?.map(
            (item): SkylinePostType => ({
              postView: item.post,
            })
          )
        );
      });
    }
  }, [did, cid]);

  return (
    <div
      className={
        "border-2 w-full sm:w-136 bg-white dark:bg-slate-800 rounded-xl mb-8 overflow-hidden " +
        BORDER_300
      }
    >
      {post && replies ? (
        <>
          <div className="pb-4">
            <Post agent={agent} post={post} isStandAlone replyButton />
            {replies.map((reply) => (
              <Post agent={agent} post={reply} />
            ))}
          </div>
        </>
      ) : (
        <LoadingPlaceholder />
      )}
    </div>
  );
}
