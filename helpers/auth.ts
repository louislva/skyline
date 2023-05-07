import { BskyAgent } from "@atproto/api";
import * as jwt from "jsonwebtoken";
import { useEffect, useRef } from "react";
import { LoginResponseDataType } from "./bsky";
import { useLocalStorageState } from "./hooks";

export type RefreshJwtType = {
  exp: number;
  iat: number;
  jti: string; // long random key
  scope: string; // "com.atproto.refresh"
  sub: string; // did
};
export type AccessJwtType = {
  exp: number;
  iat: number;
  scope: string;
  sub: string;
};

export function useAuthorization() {
  const [loginResponseData, setLoginResponseData, loginResponseDataHasLoaded] =
    useLocalStorageState<LoginResponseDataType | null>(
      "@loginResponseData",
      null
    );

  const agent = useRef<BskyAgent>(
    new BskyAgent({
      service: "https://bsky.social",
      persistSession: (evt, session) => {
        switch (evt) {
          case "create":
            if (!session) throw new Error("should be unreachable");
            setLoginResponseData(session);
            break;
          case "create-failed":
            setLoginResponseData(null);
            break;
          case "update":
            if (!session) throw new Error("should be unreachable");
            setLoginResponseData(session);
            break;
          case "expired":
            setLoginResponseData(null);
            break;
        }
      },
    })
  ).current;

  const egoHandle = loginResponseData?.handle;
  const egoDid = loginResponseData?.did;

  useEffect(() => {
    // TODO: should !agent.session be there?
    if (loginResponseData) {
      agent.resumeSession(loginResponseData);
    }
  }, [loginResponseData]);

  return {
    agent,
    egoHandle,
    egoDid,
    loginResponseData,
    setLoginResponseData,
    loginResponseDataHasLoaded,
  };
}
