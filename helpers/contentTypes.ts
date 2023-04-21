import { BlobRef } from "@atproto/api";
import { ProfileView } from "@atproto/api/dist/client/types/app/bsky/actor/defs";
import { PostView } from "@atproto/api/dist/client/types/app/bsky/feed/defs";

export type RecordType = {
  text: string;
  createdAt: string;
  reply?: {
    parent: {
      cid: string;
      uri: string;
    };
    root: {
      cid: string;
      uri: string;
    };
  };
  embed?: {
    $type: "app.bsky.embed.images" | string;
    images?: {
      alt: string;
      image: BlobRef;
    }[];
  };
};
export type ExpandedPostView = PostView & {
  record: RecordType;
};
export type SkylinePostType = {
  // Post itself
  postView: ExpandedPostView;

  // Things to-do with post type
  replyingTo?: SkylinePostType[];
  repostBy?: ProfileView;

  // Algorithm / Skyline-native stuff
  score?: number;
  notRoot?: true;
};
