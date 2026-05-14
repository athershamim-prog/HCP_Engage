export type AppRole = "business" | "compliance" | "finance" | "legal";

export const ROUTE_PERMISSIONS: Record<string, AppRole[]> = {
  "/hcps": ["business", "compliance"],
  "/hcps/new": ["business", "compliance"],
  "/dashboard": ["finance"],
  "/fmv": ["compliance"],
  "/fmv/upload": ["compliance"],
  "/engagements": ["business", "compliance", "finance", "legal"],
  "/engagements/new": ["business", "compliance"],
  "/engagements/queue": ["compliance", "finance"],
  "/engagements/legal-queue": ["legal", "compliance"],
};

export const ROLE_LABELS: Record<AppRole, string> = {
  business: "Business User",
  compliance: "Compliance Officer",
  finance: "Finance User",
  legal: "Legal Counsel",
};

export const ROLE_DEFAULT_ROUTES: Record<AppRole, string> = {
  business: "/hcps",
  compliance: "/hcps",
  finance: "/dashboard",
  legal: "/engagements/legal-queue",
};

/**
 * Computes the effective role set for a user.
 * Primary role comes from Clerk publicMetadata.role.
 * UserGrant DB expansion is passed in as grantedRoles (read by Server Component, not middleware).
 */
export function getEffectiveRoles(params: {
  role: string | undefined;
  grants: string[];
}): AppRole[] {
  const { role, grants } = params;
  const primary = role as AppRole | undefined;
  if (!primary) return [];

  const all = new Set<AppRole>([primary]);
  for (const g of grants) {
    if (g === "business" || g === "compliance" || g === "finance" || g === "legal") {
      all.add(g as AppRole);
    }
  }
  return Array.from(all);
}

/**
 * Returns true if any of the effectiveRoles can access the given route.
 * Route matching is prefix-based for nested routes (e.g., /hcps/[id] matches /hcps).
 */
export function canAccessRoute(params: {
  effectiveRoles: AppRole[];
  route: string;
}): boolean {
  const { effectiveRoles, route } = params;

  for (const [pattern, allowedRoles] of Object.entries(ROUTE_PERMISSIONS)) {
    if (route === pattern || route.startsWith(pattern + "/")) {
      return effectiveRoles.some((r) => allowedRoles.includes(r));
    }
  }
  // Routes not in the map are accessible to all authenticated users
  return true;
}

/**
 * Asserts that the current user has one of the required roles.
 * Throws an error if the user does not have the required role.
 */
export function assertRole(effectiveRoles: AppRole[], requiredRoles: AppRole[]): void {
  const hasRole = effectiveRoles.some((r) => requiredRoles.includes(r));
  if (!hasRole) {
    throw new Error(
      `Access denied. Required roles: ${requiredRoles.join(", ")}. User has: ${effectiveRoles.join(", ")}`
    );
  }
}
