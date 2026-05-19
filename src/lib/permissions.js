export function isAdmin(user) {
  return user?.role === "admin";
}

/** Sections a standard user may open in Settings (dashboard layout only). */
const USER_SETTINGS_SECTIONS = new Set(["dashboard"]);

export function canAccessSettingsSection(user, sectionKey) {
  if (!sectionKey) return true;
  if (isAdmin(user)) return true;
  return USER_SETTINGS_SECTIONS.has(sectionKey);
}

export function filterSettingsSections(sections, user) {
  if (isAdmin(user)) return sections;
  return sections.filter((s) => USER_SETTINGS_SECTIONS.has(s.key));
}
