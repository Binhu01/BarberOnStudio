"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Tipos definidos localmente para evitar importar de @/lib/organizations
 * (módulo server-only que usa cookies() e createAdminClient).
 * Com cacheComponents:true, importar módulos server-only em componentes
 * client pode causar falha silenciosa na hidratação → tela preta.
 */
export interface ClientOrganization {
  id: string;
  name: string;
  slug: string;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  membership: {
    id: string;
    organization_id: string;
    user_id: string;
    role: string;
    status: "active" | "suspended";
    created_at: string;
  };
}

interface OrganizationContextType {
  org: ClientOrganization;
  allOrgs: ClientOrganization[];
}

const OrganizationContext = createContext<OrganizationContextType | null>(null);

export function OrganizationProvider({
  children,
  org,
  allOrgs,
}: {
  children: ReactNode;
  org: ClientOrganization;
  allOrgs: ClientOrganization[];
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