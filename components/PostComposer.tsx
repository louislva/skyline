import { RecordType } from "@/helpers/contentTypes";
import { INPUT_CLASSNAME } from "@/helpers/styling";
import { BskyAgent, RichText } from "@atproto/api";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { ComposingPostType } from "./ControllerContext";
import Modal from "./Modal";
import { QuotePost } from "./Post";

export default function PostComposer(props: {
  agent: BskyAgent;
  egoHandle: string;
  composingPost: ComposingPostType;
  setComposingPost: (post: ComposingPostType | null) => void;
}) {
  const router = useRouter();

  const { agent, egoHandle, composingPost, setComposingPost } = props;
  const quotePost = composingPost?.quotePost;
  const replyingTo = composingPost?.replyingTo;

  const [draft, setDraft] = useState<string>("");
  const charactersLeft = 300 - draft.length;
  const postDisabled = !(charactersLeft >= 0 && draft.trim().length > 0);

  useEffect(() => {
    setDraft(composingPost?.text || "");
  }, [composingPost]);

  const submit = async () => {
    const rt = new RichText({ text: draft });
    await rt.detectFacets(agent);

    const response = await agent.post({
      text: rt.text,
      facets: rt.facets,
      ...(replyingTo ? { reply: replyingTo } : {}),
      ...(quotePost
        ? {
            $type: "app.bsky.embed.record",
            record: {
              cid: quotePost.postView.cid,
              uri: quotePost.postView.uri,
            },
          }
        : {}),
    });
    setComposingPost(null);
    const url = `/profile/${egoHandle}/post/${
      response.uri?.split("/").slice(-1)?.[0]
    }`;
    router.push(url);
  };

  return (
    <>
      <button
        className="fixed bottom-0 right-0 m-6 w-16 h-16 rounded-full flex items-center justify-center text-slate-50 bg-blue-500 border-2 border-blue-500 shadow-lg material-icons text-3xl unselectable outline-none"
        onClick={() =>
          setComposingPost({
            text: "",
          })
        }
      >
        edit_note
      </button>
      {!!composingPost && (
        <Modal
          close={() => {
            setComposingPost(null);
          }}
        >
          <div className="flex flex-row justify-between items-center pb-3">
            <button
              className="material-icons text-2xl bg-transparent"
              onClick={() => setComposingPost(null)}
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
          {replyingTo && (
            <>
              <div>Replying to:</div>
              <QuotePost
                linkDisabled
                embed={{
                  $type: "DONT NEED THIS I THINK",
                  record: {
                    author: replyingTo.parent.author,
                    value: replyingTo.parent.record as RecordType,
                    cid: replyingTo.parent.cid,
                    uri: replyingTo.parent.uri,
                  },
                }}
              />
              <div className="mb-3"></div>
            </>
          )}
          <textarea
            className={
              "w-full h-48 outline-none text-md p-4 outline-none rounded-md resize-none " +
              INPUT_CLASSNAME
            }
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
          {quotePost && (
            <>
              <div>Quoting:</div>
              <QuotePost
                embed={{
                  $type: "DONT NEED THIS I THINK",
                  record: {
                    author: quotePost?.postView.author,
                    value: quotePost?.postView.record,
                    cid: quotePost?.postView.cid,
                    uri: quotePost?.postView.uri,
                  },
                }}
              />
            </>
          )}
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
