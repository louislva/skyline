import { useControllerContext } from "@/components/ControllerContext";
import { LoadMoreButton } from "@/components/LoadMoreButton";
import { LoadingPlaceholder } from "@/components/LoadingSpinner";
import { QuotePost, QuotePostLoadingPlaceholder } from "@/components/Post";
import { RecordType } from "@/helpers/contentTypes";
import { BORDER_300 } from "@/helpers/styling";
import { BskyAgent } from "@atproto/api";
import { PostView } from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import { Notification } from "@atproto/api/dist/client/types/app/bsky/notification/listNotifications";
import moment from "moment";
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
  const { setNotificationsCount } = useControllerContext();

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
    agent.app.bsky.notification
      .updateSeen({
        seenAt: new Date().toJSON(),
      })
      .then(() => setNotificationsCount(0));
  }, []);

  const cosignedNotifications = useMemo<Notification[][]>(() => {
    if (!notifications) return [];
    return Object.values(
      notifications
        .sort((a, b) => {
          return (
            new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime()
          );
        })
        .reduce((acc, item) => {
          let id = "";
          switch (item.reason) {
            case "like":
              id = "like-" + item.reasonSubject;
              break;
            case "repost":
              id = "repost-" + item.reasonSubject;
              break;
            case "follow":
              id =
                "follow-" +
                Math.floor(
                  new Date(item.indexedAt).getTime() / (1000 * 60 * 30)
                );
              break;
            case "reply":
              id = "reply-" + item.cid;
              break;
            case "quote":
              id = "quote-" + item.cid;
              break;
            case "mention":
              id = "mention-" + item.cid;
              break;
            default:
              break;
          }
          acc[id] = acc[id] || [];
          acc[id].push(item);
          return acc;
        }, {} as { [key: string]: Notification[] })
    ).sort((a, b) => {
      return (
        new Date(b[0].indexedAt).getTime() - new Date(a[0].indexedAt).getTime()
      );
    });
  }, [notifications]);

  return (
    <div
      className={
        "border-2 w-full sm:w-136 bg-white dark:bg-slate-800 rounded-xl mb-8 overflow-hidden " +
        BORDER_300
      }
    >
      {notifications !== null ? (
        <ul>
          {cosignedNotifications?.map((item) => (
            <Notification agent={agent} notifications={item} />
          ))}
          <LoadMoreButton loadMore={loadMore} loading={loading} />
        </ul>
      ) : (
        <LoadingPlaceholder />
      )}
    </div>
  );
}

function Notification(props: {
  agent: BskyAgent;
  notifications: Notification[];
}) {
  const { agent, notifications } = props;
  const notification = notifications[0];

  const displayName =
    notification.author.displayName +
    (notifications.length > 2
      ? ` and ${notifications.length - 1} others`
      : notifications.length > 1
      ? ` and 1 other person`
      : "");

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
        <div className="flex flex-row items-center">
          {notifications.slice(0, 5).map((item, index) => (
            <Link
              href={`/profile/${item.author.handle}`}
              className="w-8 h-8 rounded-full bg-blue-600 overflow-hidden mr-1"
              style={{
                zIndex: 11 - index,
              }}
            >
              {item.author.avatar && (
                <img src={item.author.avatar} className="w-full h-full" />
              )}
            </Link>
          ))}
          {notifications.length > 5 && (
            <div className="text-slate-500 dark:text-slate-400 text-lg ml-1">
              +{notifications.length - 5}
            </div>
          )}
        </div>
        <div className="flex flex-row items-start">
          <div className="flex-1">
            <Link
              href={`/profile/${notification.author.handle}`}
              className="inline"
            >
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
          </div>
          <div className="ml-2 text-right text-slate-400">
            {moment(new Date(notification.indexedAt)).fromNow()}
          </div>
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
        ) : ["like", "repost"].includes(notification.reason) ? (
          reasonSubjectPost ? (
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
          ) : (
            <QuotePostLoadingPlaceholder />
          )
        ) : null}
      </div>
    </li>
  );
}
