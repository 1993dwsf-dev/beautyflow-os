import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { FeatureKey, Permission } from "@/convex/lib/permissions";
import { useQuery } from "convex/react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "beautyflow.orgId";

type OrgContextValue = {
  orgs: { _id: Id<"organizations">; name: string; role: string; isDemo: boolean }[];
  orgId: Id<"organizations"> | null;
  selectOrg: (id: Id<"organizations">) => void;
  context:
    | {
        org: any;
        member: any;
        flags: Record<string, boolean>;
        permissions: string[];
        staffCount: number;
        unreadNotifications: number;
        today: string;
      }
    | null
    | undefined;
  can: (permission: Permission) => boolean;
  flag: (key: FeatureKey) => boolean;
  isLoading: boolean;
  hasNoOrg: boolean;
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const orgs = useQuery(api.orgs.myOrganizations);
  const [storedId, setStoredId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem(STORAGE_KEY),
  );

  const selectOrg = useCallback((id: Id<"organizations">) => {
    setStoredId(id as string);
    try {
      window.localStorage.setItem(STORAGE_KEY, id as string);
    } catch {
      /* storage may be unavailable */
    }
  }, []);

  // The active organization is derived from the stored id when it is still a
  // valid membership, and falls back to the first available space. Deriving it
  // instead of syncing it in an effect avoids an extra render pass per mount.
  const orgId = useMemo<Id<"organizations"> | null>(() => {
    const list = orgs ?? [];
    if (storedId && list.some((o) => (o._id as string) === storedId)) {
      return storedId as Id<"organizations">;
    }
    return (list[0]?._id as Id<"organizations"> | undefined) ?? null;
  }, [orgs, storedId]);

  const context = useQuery(
    api.orgs.orgContext,
    orgId ? { orgId } : "skip",
  );

  const can = useCallback(
    (permission: Permission) =>
      (context?.permissions ?? []).includes(permission),
    [context],
  );

  const flag = useCallback(
    (key: FeatureKey) => context?.flags?.[key] ?? true,
    [context],
  );

  const value = useMemo<OrgContextValue>(
    () => ({
      orgs: (orgs ?? []) as OrgContextValue["orgs"],
      orgId,
      selectOrg,
      context: context as OrgContextValue["context"],
      can,
      flag,
      isLoading: orgs === undefined || (orgId !== null && context === undefined),
      hasNoOrg: (orgs ?? []).length === 0,
    }),
    [orgs, orgId, selectOrg, context, can, flag],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useApp() {
  const value = useContext(OrgContext);
  if (!value) {
    throw new Error("useApp precisa estar dentro de <AppProvider>");
  }
  return value;
}
