import { BskyAgent } from "@atproto/api";
import { useEffect, useState } from "react";
import Modal from "./Modal";
import { INPUT_CLASSNAME } from "@/helpers/styling";

export default function TweetComposer(props: { agent: BskyAgent }) {
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
