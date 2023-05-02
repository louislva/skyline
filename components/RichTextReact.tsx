import { LINK } from "@/helpers/styling";
import { BskyAgent, RichText } from "@atproto/api";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";

export default function RichTextReact(props: {
  agent: BskyAgent;
  text: string;
}) {
  const { agent, text } = props;
  const [segments, setSegments] = useState<
    {
      type: "text" | "link" | "mention";
      text: string;
      value?: string;
    }[]
  >([]);

  useEffect(() => {
    (async () => {
      const rt = new RichText({
        text,
      });
      await rt.detectFacets(agent); // automatically detects mentions and links

      let newSegments: typeof segments = [];

      // @ts-expect-error
      for (const segment of rt.segments()) {
        if (segment.isLink()) {
          newSegments.push({
            type: "link",
            text: segment.text,
            value: segment.link?.uri,
          });
        } else if (segment.isMention()) {
          newSegments.push({
            type: "mention",
            text: segment.text,
            value: segment.mention.did,
          });
        } else {
          newSegments.push({
            type: "text",
            text: segment.text,
          });
        }
      }

      setSegments(newSegments);
    })();
  }, [text]);

  return (
    <>
      {segments.map((segment) => {
        return (
          <>
            {segment.text.split("\n").map((line, index) => {
              return (
                <Fragment key={index}>
                  {index !== 0 && <br />}
                  {segment.type === "link" ? (
                    <Link
                      href={segment.value || ""}
                      target="_blank"
                      rel="noreferrer"
                      className={LINK}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {line}
                    </Link>
                  ) : segment.type === "mention" ? (
                    <Link
                      href={`/profile/${segment.value}`}
                      className={LINK}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {line}
                    </Link>
                  ) : (
                    line
                  )}
                </Fragment>
              );
            })}
          </>
        );
      })}
    </>
  );
}
