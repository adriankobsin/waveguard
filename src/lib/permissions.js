export function isAdmin(user) {
  return user?.role === "admin";
}

export function isTechnician(user) {
  return user?.role === "admin" || user?.role === "technician";
}

export const ROLE_LABELS = {
  admin: "Administrator",
  technician: "Technician",
  user: "Crew / operator",
  viewer: "Viewer (read-only)",
};

export const ROLE_DESCRIPTIONS = {
  admin: "Everything, including users, credentials, updates and factory reset",
  technician: "Network scans, monitors, config backups, discovery and device settings",
  user: "Day-to-day control: lighting, audio, HVAC, maintenance tasks",
  viewer: "Can look at everything but change nothing",
};

export function hasFullSettingsAccess(user) {
  return isAdmin(user);
}

/** Sections each non-admin role may open in Settings. */
const ROLE_SETTINGS_SECTIONS = {
  technician: new Set(["account", "dashboard", "help", "discovery", "integrations", "site-locations", "system"]),
  user: new Set(["account", "dashboard", "help"]),
  viewer: new Set(["account", "help"]),
};

export function canAccessSettingsSection(user, sectionKey) {
  if (!sectionKey) return true;
  if (hasFullSettingsAccess(user)) return true;
  return ROLE_SETTINGS_SECTIONS[user?.role]?.has(sectionKey) ?? false;
}

export function filterSettingsSections(sections, user) {
  if (hasFullSettingsAccess(user)) return sections;
  return sections.filter((s) => canAccessSettingsSection(user, s.key));
}
