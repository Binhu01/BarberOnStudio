"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { UserOrganization } from "@/lib/organizations";

interface OrganizationContextType {
  org: UserOrganization;
  allOrgs: UserOrganization[];
}

const OrganizationContext = createContext<OrganizationContextType | null>(null);

export function OrganizationProvider({
  children,
  org,
  allOrgs,
}: {
  children: ReactNode;
  org: UserOrganization;
  allOrgs: UserOrganization[];
}) {
  return (
    <OrganizationContext.Provider value={{ org, allOrgs }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext);
  if (!ctx) {
    throw new Error("useOrganization must be used within OrganizationProvider");
  }
  return ctx;
}