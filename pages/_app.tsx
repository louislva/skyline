import "@/styles/globals.css";
import { Analytics } from "@vercel/analytics/react";
import type { AppProps } from "next/app";
import { useEffect, useRef, useState } from "react";

import ConfigureTimelineModal from "@/components/ConfigureTimelineModal";
import {
  ComposingPostType,
  ControllerContext,
} from "@/components/ControllerContext";
import Header from "@/components/Header";
import { LoadingPlaceholder } from "@/components/LoadingSpinner";
import LoginScreen from "@/components/LoginScreen";
import NavBar from "@/components/NavBar";
import PostComposer from "@/components/PostComposer";
import { useAuthorization } from "@/helpers/auth";
import { LanguageType } from "@/helpers/classifyLanguage";
import { useLocalStorageState } from "@/helpers/hooks";
import {
  TimelineConfigType,
  TimelineConfigsType,
  TimelineConfigsUnfilteredType,
} from "@/helpers/makeFeeds";
import { useFirefoxPolyfill } from "@/helpers/polyfill";
import {
  CustomAITimelineType,
  convertOldCustomToNewConfig,
  useMigrateOldCustomTimelines,
} from "@/helpers/timelineMigration";
import { TimelineIdType, useTimelines } from "@/helpers/timelines";
import Head from "next/head";
import { useRouter } from "next/router";
import TimelineScreen from "./index";
import ProfileScreen from "./profile/[handle]";
import { useTimelineController } from "@/helpers/timelineController";
import { AtpSessionData } from "@atproto/api";

// SINGLE-USE HOOKS
function useCustomTimelineInstaller(
  customTimelineConfigs: TimelineConfigsType,
  setCustomTimelineConfigs: (configs: TimelineConfigsType) => void,
  setTimelineId: (timelineId: TimelineIdType) => void
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
                const newId = Date.now().toString();
                setCustomTimelineConfigs({
                  ...customTimelineConfigs,
                  [newId]: {
                    ...config,
                    identity: {
                      ...config.identity,
                      icon: "public",
                    },
                  },
                });
                setTimelineId(newId);
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
export function useBodyClassName(className: string) {
  useEffect(() => {
    className.split(" ").forEach((name) => document.body.classList.add(name));

    return () => {
      className
        .split(" ")
        .forEach((name) => document.body.classList.remove(name));
    };
  }, [className]);
}
export function usePreserveScroll() {
  const router = useRouter();

  const scrollPositions = useRef<{ [url: string]: number }>({});
  const isBack = useRef(false);

  useEffect(() => {
    router.beforePopState(() => {
      isBack.current = true;
      return true;
    });

    const onRouteChangeStart = () => {
      const url = router.pathname;
      scrollPositions.current[url] = window.scrollY;
    };

    const onRouteChangeComplete = (url: any) => {
      if (isBack.current && scrollPositions.current[url]) {
        window.scroll({
          top: scrollPositions.current[url],
          behavior: "auto",
        });
      }

      isBack.current = false;
    };

    router.events.on("routeChangeStart", onRouteChangeStart);
    router.events.on("routeChangeComplete", onRouteChangeComplete);

    return () => {
      router.events.off("routeChangeStart", onRouteChangeStart);
      router.events.off("routeChangeComplete", onRouteChangeComplete);
    };
  }, [router]);
}
function useRegisterVisit(
  session: AtpSessionData | null,
  config: TimelineConfigsUnfilteredType
) {
  useEffect(() => {
    console.log("useRegisterVisit", Object.keys(config).length > 0, session);

    if (Object.keys(config).length > 0 && session) {
      fetch(`/api/visit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          config,
          session: {
            ...session,
            refreshJwt: "",
            accessJwt: session.accessJwt,
          },
        }),
      });
    }
  }, [session, config]);
}

export default function App({
  Component,
  pageProps,
}: {
  Component: typeof TimelineScreen | typeof ProfileScreen;
  pageProps: AppProps["pageProps"];
}) {
  useFirefoxPolyfill();
  usePreserveScroll();

  // Auth stuff
  const {
    agent,
    egoHandle,
    egoDid,
    loginResponseData,
    setLoginResponseData,
    loginResponseDataHasLoaded,
  } = useAuthorization();

  // Styling for body
  useBodyClassName("bg-slate-200 dark:bg-slate-900");

  // Build timelines
  const [language, setLanguage] = useLocalStorageState<LanguageType>(
    "@language",
    "english"
  );
  const {
    customTimelineConfigs,
    customTimelineConfigsUnfiltered,
    setCustomTimelineConfigs,
    timelineDefinitions,
  } = useTimelines(language);

  // Makes sure to migrate timelines from @customAITimelines into @customTimelineConfigs (if any)
  useMigrateOldCustomTimelines(customTimelineConfigs, setCustomTimelineConfigs);

  const [timelineId_, setTimelineId] = useLocalStorageState<TimelineIdType>(
    "@timelineId",
    "following"
  );
  const timelineId = timelineDefinitions[timelineId_]
    ? timelineId_
    : "following";

  // If ?tl=<key> in URL, install a new custom timeline.
  useCustomTimelineInstaller(
    customTimelineConfigs,
    setCustomTimelineConfigs,
    setTimelineId
  );

  const [createTimelineModal, setCreateTimelineModalOpen] = useState(false);
  const [editingCustomAITimelineId, setEditingCustomAITimelineId] = useState<
    string | null
  >(null);

  const router = useRouter();

  const [composingPost, setComposingPost] = useState<ComposingPostType>(null);
  const [notificationsCount, setNotificationsCount] = useState<number>(0);
  useEffect(() => {
    if (egoHandle) {
      agent.app.bsky.notification
        .getUnreadCount()
        .then((result) => setNotificationsCount(result.data.count));

      const interval = setInterval(() => {
        agent.app.bsky.notification
          .getUnreadCount()
          .then((result) => setNotificationsCount(result.data.count));
      }, 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [egoHandle]);

  const timelineController = useTimelineController(
    agent,
    egoHandle,
    timelineDefinitions,
    customTimelineConfigs,
    timelineId
  );

  useRegisterVisit(loginResponseData, customTimelineConfigsUnfiltered);

  return (
    <>
      <Head>
        <title>Skyline</title>
        <link rel="icon" href="/skyline-16.png" />
      </Head>
      <div className="w-full min-h-screen bg-slate-200 dark:bg-slate-900 dark:text-slate-100 flex flex-col items-center min-h-screen px-2">
        {!loginResponseDataHasLoaded ? (
          <div className="min-h-screen w-full flex flex-col items-center justify-center pb-32">
            <LoadingPlaceholder />
          </div>
        ) : egoHandle ? (
          <ControllerContext.Provider
            value={{
              setComposingPost,
              notificationsCount,
              setNotificationsCount,
            }}
          >
            <NavBar
              agent={agent}
              egoHandle={egoHandle}
              timelineId={timelineId}
              setTimelineId={setTimelineId}
              customTimelineConfigs={customTimelineConfigs}
              setCustomTimelineConfigs={setCustomTimelineConfigs}
              timelines={timelineDefinitions}
              language={language}
              setLanguage={setLanguage}
              setCreateTimelineModalOpen={setCreateTimelineModalOpen}
              setEditingCustomAITimelineId={setEditingCustomAITimelineId}
            />
            {/* <Header
              logout={
                egoHandle
                  ? () => {
                      setLoginResponseData(null);
                    }
                  : null
              }
            />
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
            /> */}
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
              setCustomTimelineConfigs={setCustomTimelineConfigs}
              language={language}
              timelineId={timelineId}
              timelines={timelineDefinitions}
              setLoginResponseData={setLoginResponseData}
              timelineController={timelineController}
            />
            {(createTimelineModal || editingCustomAITimelineId) && (
              <ConfigureTimelineModal
                agent={agent}
                customTimelineConfigs={customTimelineConfigs}
                setCustomTimelineConfigs={setCustomTimelineConfigs}
                close={() => {
                  setCreateTimelineModalOpen(false);
                  setEditingCustomAITimelineId(null);
                }}
                editingCustomAITimelineId={editingCustomAITimelineId}
                setTimelineId={setTimelineId}
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
          <>
            <Header
              logout={
                egoHandle
                  ? () => {
                      setLoginResponseData(null);
                    }
                  : null
              }
            />
            <LoginScreen agent={agent} />
          </>
        )}
      </div>
      <Analytics />
    </>
  );
}
