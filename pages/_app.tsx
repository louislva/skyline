import "@/styles/globals.css";
import { Analytics } from "@vercel/analytics/react";
import type { AppProps } from "next/app";
import { useEffect, useRef, useState } from "react";

import ConfigureTimelineModal from "@/components/ConfigureTimelineModal";
import Header from "@/components/Header";
import LoginScreen from "@/components/LoginScreen";
import TimelinePicker from "@/components/TimelinePicker";
import { useAuthorization } from "@/helpers/auth";
import { LanguageType } from "@/helpers/classifyLanguage";
import { useLocalStorageState } from "@/helpers/hooks";
import { TimelineConfigType, TimelineConfigsType } from "@/helpers/makeFeeds";
import { useFirefoxPolyfill } from "@/helpers/polyfill";
import {
  CustomAITimelineType,
  CustomAITimelinesType,
  convertOldCustomToNewConfig,
  useMigrateOldCustomTimelines,
} from "@/helpers/timelineMigration";
import { TimelineIdType, useTimelines } from "@/helpers/timelines";
import { BskyAgent } from "@atproto/api";
import Head from "next/head";
import { useRouter } from "next/router";
import TimelineScreen from "./index";
import ProfileScreen from "./profile/[handle]";
import PostComposer from "@/components/PostComposer";
import {
  ComposingPostType,
  ControllerContext,
} from "@/components/ControllerContext";

// SINGLE-USE HOOKS
function useCustomTimelineInstaller(
  customTimelineConfigs: TimelineConfigsType,
  setCustomTimelineConfigs: (configs: TimelineConfigsType) => void
) {
  const router = useRouter();
  useEffect(() => {
    if (router.query.tl) {
      fetch(`/api/shared_custom_timeline?key=${router.query.tl}`).then(
        (res) => {
          if (res.ok) {
            res.json().then(
              (
                json:
                  | {
                      config: CustomAITimelineType;
                      config_new: null;
                    }
                  | {
                      config: null;
                      config_new: TimelineConfigType;
                    }
              ) => {
                router.replace("/", undefined, {
                  scroll: false,
                  shallow: true,
                });
                const config = json.config_new
                  ? json.config_new
                  : convertOldCustomToNewConfig(json.config);
                setCustomTimelineConfigs({
                  ...customTimelineConfigs,
                  [Date.now().toString()]: {
                    ...config,
                    identity: {
                      ...config.identity,
                      icon: "public",
                    },
                  },
                });
              }
            );
          } else {
            throw Error("Couldn't GET shared_ai_timeline: " + res.statusText);
          }
        }
      );
    }
  }, [router.query.tl]);
}
function useBodyClassName(className: string) {
  useEffect(() => {
    className.split(" ").forEach((name) => document.body.classList.add(name));

    return () => {
      className
        .split(" ")
        .forEach((name) => document.body.classList.remove(name));
    };
  }, [className]);
}

export default function App({
  Component,
  pageProps,
}: {
  Component: typeof TimelineScreen | typeof ProfileScreen;
  pageProps: AppProps["pageProps"];
}) {
  useFirefoxPolyfill();

  // Auth stuff
  const { agent, egoHandle, egoDid, setLoginResponseData } = useAuthorization();

  // Styling for body
  useBodyClassName("bg-slate-50 dark:bg-slate-900");

  // Build timelines
  const [language, setLanguage] = useLocalStorageState<LanguageType>(
    "@language",
    "english"
  );
  const {
    customTimelineConfigs,
    setCustomTimelineConfigs,
    timelineDefinitions,
  } = useTimelines(language);

  // Makes sure to migrate timelines from @customAITimelines into @customTimelineConfigs (if any)
  useMigrateOldCustomTimelines(customTimelineConfigs, setCustomTimelineConfigs);

  // If ?tl=<key> in URL, install a new custom timeline.
  useCustomTimelineInstaller(customTimelineConfigs, setCustomTimelineConfigs);

  const [timelineId_, setTimelineId] = useLocalStorageState<TimelineIdType>(
    "@timelineId",
    "following"
  );
  const timelineId = timelineDefinitions[timelineId_]
    ? timelineId_
    : "following";

  const [createTimelineModal, setCreateTimelineModalOpen] = useState(false);
  const [editingCustomAITimelineId, setEditingCustomAITimelineId] = useState<
    string | null
  >(null);

  const router = useRouter();

  const [composingPost, setComposingPost] = useState<ComposingPostType>(null);

  return (
    <>
      <Head>
        <title>Skyline</title>
        <link rel="icon" href="/skyline-16.png" />
      </Head>
      <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-900 dark:text-slate-100 flex flex-col items-center min-h-screen px-2">
        <Header
          logout={
            egoHandle
              ? () => {
                  setLoginResponseData(null);
                }
              : null
          }
        />
        {egoHandle ? (
          <ControllerContext.Provider value={{ setComposingPost }}>
            <TimelinePicker
              timelineId={timelineId}
              setTimelineId={setTimelineId}
              customTimelineConfigs={customTimelineConfigs}
              setCustomTimelineConfigs={setCustomTimelineConfigs}
              egoHandle={egoHandle}
              timelines={timelineDefinitions}
              language={language}
              setLanguage={setLanguage}
              setCreateTimelineModalOpen={setCreateTimelineModalOpen}
              setEditingCustomAITimelineId={setEditingCustomAITimelineId}
            />
            <Component
              // React stuff
              {...pageProps}
              key={router.asPath}
              // Bsky stuff
              egoHandle={egoHandle}
              egoDid={egoDid}
              agent={agent}
              // Skyline stuff
              customTimelineConfigs={customTimelineConfigs}
              language={language}
              timelineId={timelineId}
              timelines={timelineDefinitions}
            />
            {(createTimelineModal || editingCustomAITimelineId) && (
              <ConfigureTimelineModal
                customTimelineConfigs={customTimelineConfigs}
                setCustomTimelineConfigs={setCustomTimelineConfigs}
                close={() => {
                  setCreateTimelineModalOpen(false);
                  setEditingCustomAITimelineId(null);
                }}
                editingCustomAITimelineId={editingCustomAITimelineId}
              />
            )}
            <PostComposer
              agent={agent}
              egoHandle={egoHandle}
              composingPost={composingPost}
              setComposingPost={setComposingPost}
            />
          </ControllerContext.Provider>
        ) : (
          <LoginScreen agent={agent} />
        )}
      </div>
      <Analytics />
    </>
  );
}
