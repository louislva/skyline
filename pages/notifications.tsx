import { LoadingPlaceholder } from "@/components/LoadingSpinner";
import { QuotePost } from "@/components/Post";
import { LoadMoreButton } from "@/components/Timeline";
import { RecordType } from "@/helpers/contentTypes";
import { BORDER_300 } from "@/helpers/styling";
import { BskyAgent } from "@atproto/api";
import { PostView } from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import { Notification } from "@atproto/api/dist/client/types/app/bsky/notification/listNotifications";
import Link from "next/link";
import { useRouter } from "next/router";
import { SyntheticEvent, useEffect, useMemo, useState } from "react";

// TIMELINE SCREEN
export type NotificationsScreenProps = {
  agent: BskyAgent;
  egoHandle: string;
  egoDid: string;
};
export default function NotificationsScreen(props: NotificationsScreenProps) {
  const { agent } = props;
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<Notification[] | null>(
    null
  );
  const [cursor, setCursor] = useState<string | undefined>();

  const loadMore = async () => {
    setLoading(true);
    agent.app.bsky.notification
      .listNotifications({
        limit: 10,
        cursor,
      })
      .then((result) => {
        setNotifications(
          (notifications || []).concat(result.data.notifications)
        );
        setCursor(result.data.cursor);
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadMore();
  }, []);

  console.log({ notifications });

  return (
    <div
      className={
        "border-2 w-full sm:w-136 bg-white dark:bg-slate-800 rounded-xl mb-8 overflow-hidden " +
        BORDER_300
      }
    >
      {true ? (
        <ul>
          {notifications?.map((item) => (
            <Notification agent={agent} notification={item} />
          ))}
          <LoadMoreButton loadMore={loadMore} loading={loading} />
        </ul>
      ) : (
        <LoadingPlaceholder />
      )}
    </div>
  );
}

function Notification(props: { agent: BskyAgent; notification: Notification }) {
  const { agent, notification } = props;
  const router = useRouter();
  const navigate = router.push;
  const [isOpen, setIsOpen] = useState(false);
  const isReply = notification.reason == "reply";

  const linkUrl = useMemo(() => {
    if (notification.reason == "follow") {
      return `/profile/${notification.author.handle}`;
    }
    if (notification.reason == "quote" || notification.reason == "mention") {
      return `/profile/${notification.author.handle}/post/${
        notification.uri?.split("/")?.slice(-1)?.[0]
      }`;
    }
    if (notification.post || isReply) {
      // alert("WUT");
      // return navigate(linkFromPost(null, notifGroup.subjectUri));
    }
    return "";
  }, [notification]);

  // const displayName = useMemo(() => {
  //   if (notification.datas.length && notification.datas.length - 1 > 0) {
  //     // @ts-ignore
  //     return `${
  //       notification.datas[0]?.author.displayName ||
  //       notification.datas[0]?.author.handle
  //     }${
  //       ", " +
  //       notification.datas
  //         .slice(1, Math.min(5, notification.datas.length))
  //         .map(
  //           (notif: PostView) =>
  //             notif.author.displayName || "@" + notif.author.handle
  //         )
  //         .join(",")
  //     } and ${notification.datas.length - 1} others`;
  //   } else {
  //     return (
  //       notification.datas[0]?.author.displayName ||
  //       notification.datas[0]?.author.handle
  //     );
  //   }
  // }, [notification.datas[0]]);
  const displayName = notification.author.displayName;

  const _handleOpen = (e: SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsOpen((prev) => !prev);
  };

  // Largely copied from here: https://github.com/callmearta/kite/blob/main/src/pages/notifications/Notification.tsx

  const [reasonSubjectPost, setReasonSubjectPost] = useState<PostView | null>(
    null
  );
  useEffect(() => {
    if (
      notification.reasonSubject &&
      !["mention", "quote", "reply"].includes(notification.reason)
    ) {
      agent
        .getPostThread({
          uri: notification.reasonSubject,
          depth: 0,
        })
        .then((result) => {
          setReasonSubjectPost(
            (result?.data?.thread?.post as PostView | undefined) || null
          );
        });
    }
  }, [notification.reasonSubject]);

  return (
    <li
      className={
        "flex flex-row py-3 px-6 border-b " +
        BORDER_300 +
        (notification.isRead
          ? "bg-slate-100 dark:bg-slate-800"
          : "bg-white dark:bg-slate-700/50")
      }
    >
      <div
        className={
          "material-icons pr-2 text-2xl " +
          {
            like: "text-red-500",
            repost: "text-green-500",
            follow: "text-blue-500",
            reply: "text-yellow-500",
            quote: "text-yellow-500",
            mention: "text-blue-500",
          }[notification.reason as string]
        }
      >
        {
          {
            like: "favorite",
            repost: "repeat",
            follow: "person_add",
            reply: "reply",
            quote: "repeat",
            mention: "person",
          }[notification.reason as string]
        }
      </div>
      <div className="flex-1 flex flex-col">
        <Link
          href={`/profile/${notification.author.handle}`}
          className="w-8 h-8 rounded-full bg-blue-600 overflow-hidden mr-2"
        >
          {notification.author.avatar && (
            <img src={notification.author.avatar} className="w-full h-full" />
          )}
        </Link>
        <div className="flex flex-row items-center">
          <Link href={`/profile/${notification.author.handle}`}>
            <strong className="mr-1">{displayName}</strong>
          </Link>
          {
            {
              like: "liked your post",
              repost: "reposted your post",
              follow: "followed you",
              reply: "replied to your post",
              quote: "quoted your post",
              mention: "mentioned you",
            }[notification.reason as string]
          }
          <span className="ml-1 text-right text-slate-400">1h</span>
        </div>
        {["mention", "quote", "reply"].includes(notification.reason) ? (
          <QuotePost
            embed={{
              $type: "DONT NEED THIS I THINK",
              record: {
                author: notification.author,
                value: notification.record as RecordType,
                cid: notification.cid,
                uri: notification.uri,
              },
            }}
          />
        ) : (
          reasonSubjectPost && (
            <QuotePost
              embed={{
                $type: "DONT NEED THIS I THINK",
                record: {
                  author: reasonSubjectPost.author,
                  value: reasonSubjectPost.record as RecordType,
                  cid: reasonSubjectPost.cid,
                  uri: reasonSubjectPost.uri,
                },
              }}
            />
          )
        )}
      </div>
    </li>
  );
}
