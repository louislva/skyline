import { SkylinePostType } from "@/helpers/contentTypes";
import { type AppBskyFeedDefs } from "@atproto/api";
import { createContext, useContext } from "react";

export type ComposingPostType = {
  replyingTo?: AppBskyFeedDefs.ReplyRef;
  quotePost?: SkylinePostType;
  text: string;
} | null;

type ControllerContextType = {
  setComposingPost: (composingPost: ComposingPostType) => void;
  notificationsCount: number;
  setNotificationsCount: (count: number) => void;
};

export const ControllerContext = createContext<ControllerContextType>({
  setComposingPost: (_) => {},
  notificationsCount: 0,
  setNotificationsCount: (_) => {},
});

export function useControllerContext() {
  return useContext(ControllerContext);
}
