"use client";

import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";

export type ConsoleSession = { role: "owner" | "partner" | "staff"; demo: boolean };

const SessionCtx = createContext<ConsoleSession | null>(null);
const PublishCtx = createContext<(session: ConsoleSession) => void>(() => {});

/** 布局里的导航解析出登录身份后，子页（如静态操作手册）可以读到同一份角色。 */
export function ConsoleSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ConsoleSession | null>(null);
  return (
    <PublishCtx.Provider value={setSession}>
      <SessionCtx.Provider value={session}>{children}</SessionCtx.Provider>
    </PublishCtx.Provider>
  );
}

export function useConsoleSession() {
  return useContext(SessionCtx);
}

export function PublishConsoleSession({ session }: { session: ConsoleSession }) {
  const publish = useContext(PublishCtx);
  const { role, demo } = session;
  useLayoutEffect(() => {
    publish({ role, demo });
  }, [publish, role, demo]);
  return null;
}
