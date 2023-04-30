import { BskyAgent } from "@atproto/api";
import * as jwt from "jsonwebtoken";
import { useEffect } from "react";
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

export function useAuthorization(agent: BskyAgent) {
  const [loginResponseData, setLoginResponseData] =
    useLocalStorageState<LoginResponseDataType | null>(
      "@loginResponseData",
      null
    );

  const egoHandle = loginResponseData?.handle;
  const accessJwt = !!loginResponseData?.accessJwt
    ? (jwt.decode(loginResponseData.accessJwt) as AccessJwtType)
    : null;
  const loginExpiration = accessJwt?.exp;
  const timeUntilLoginExpire = loginExpiration
    ? loginExpiration * 1000 - Date.now()
    : null;
  useEffect(() => {
    if (timeUntilLoginExpire) {
      const timeout = setTimeout(() => {
        setLoginResponseData(null);
      }, Math.max(timeUntilLoginExpire, 0));

      return () => clearTimeout(timeout);
    }
  }, [timeUntilLoginExpire]);
  useEffect(() => {
    if (loginResponseData && !agent.session) {
      agent.resumeSession(loginResponseData);
    }
  }, [loginResponseData]);

  return { egoHandle, setLoginResponseData };
}
