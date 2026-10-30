"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import type { DemoBiz } from "./DemoBizSwitcher";

export type ConsoleRole = "owner" | "partner" | "staff";

export type ConsoleSession = { role: ConsoleRole; demo: boolean };

/** 顶栏展示用快照：只影响导航显隐，权限仍以服务端 / RLS 为准。 */
export type ConsoleNavChrome = {
  role: ConsoleRole;
  demo: boolean;
  email: string | null;
  grantedIds: string[];
  demoBiz: DemoBiz;
};

const SessionCtx = createContext<ConsoleSession | null>(null);
const PublishSessionCtx = createContext<(session: ConsoleSession) => void>(() => {});

const NavChromeCtx = createContext<ConsoleNavChrome | null>(null);
const PublishNavChromeCtx = createContext<(chrome: ConsoleNavChrome) => void>(() => {});

/** 布局里的导航解析出登录身份后，子页（如静态操作手册）可以读到同一份角色。 */
export function ConsoleSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ConsoleSession | null>(null);
  const [navChrome, setNavChrome] = useState<ConsoleNavChrome | null>(null);
  return (
    <PublishSessionCtx.Provider value={setSession}>
      <SessionCtx.Provider value={session}>
        <PublishNavChromeCtx.Provider value={setNavChrome}>
          <NavChromeCtx.Provider value={navChrome}>{children}</NavChromeCtx.Provider>
        </PublishNavChromeCtx.Provider>
      </SessionCtx.Provider>
    </PublishSessionCtx.Provider>
  );
}

export function useConsoleSession() {
  return useContext(SessionCtx);
}

export function useConsoleNavChrome() {
  return useContext(NavChromeCtx);
}

export function PublishConsoleSession({ session }: { session: ConsoleSession }) {
  const publish = useContext(PublishSessionCtx);
  const { role, demo } = session;
  useLayoutEffect(() => {
    publish({ role, demo });
  }, [publish, role, demo]);
  return null;
}

export function PublishConsoleNavChrome({ chrome }: { chrome: ConsoleNavChrome }) {
  const publish = useContext(PublishNavChromeCtx);
  const { role, demo, email, demoBiz } = chrome;
  const grantedKey = chrome.grantedIds.join(",");
  useLayoutEffect(() => {
    publish({
      role,
      demo,
      email,
      grantedIds: grantedKey ? grantedKey.split(",") : [],
      demoBiz,
    });
  }, [publish, role, demo, email, demoBiz, grantedKey]);
  return null;
}
