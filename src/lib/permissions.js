import { isMockServer } from "@/api/base44Client";

export function isAdmin(user) {
  return user?.role === "admin";
}

/**
 * Local mock deployments run without strict RBAC — treat missing auth as admin
 * so operators still see discovery, credentials, integrations, etc.
 */
export function hasFullSettingsAccess(user) {
  if (isAdmin(user)) return true;
  if (isMockServer && (!user || !user.role)) return true;
  return false;
}

/** Sections a standard user may open in Settings (dashboard layout and help). */
const USER_SETTINGS_SECTIONS = new Set(["dashboard", "help"]);

export function canAccessSettingsSection(user, sectionKey) {
  if (!sectionKey) return true;
  if (hasFullSettingsAccess(user)) return true;
  return USER_SETTINGS_SECTIONS.has(sectionKey);
}

export function filterSettingsSections(sections, user) {
  if (hasFullSettingsAccess(user)) return sections;
  return sections.filter((s) => USER_SETTINGS_SECTIONS.has(s.key));
}
