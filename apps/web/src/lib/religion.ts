/**
 * Religion picker options, shared by the public application form and the
 * employee records HR keeps.
 *
 * Ordered roughly by how common each is in the Philippines, so the usual answer
 * is near the top. The list is never exhaustive on purpose — "Others" opens a
 * free-text box, and whatever the person types is what gets stored, so nobody
 * has to pick a label that is not theirs.
 */
export const RELIGION_OPTIONS = [
  "Roman Catholic",
  "Islam",
  "Iglesia ni Cristo",
  "Evangelical / Born Again Christian",
  "Seventh-day Adventist",
  "Aglipayan (Philippine Independent Church)",
  "Jehovah's Witness",
  "Baptist",
  "Protestant",
  "Members Church of God International",
  "Buddhism",
  "Hinduism",
  "Judaism",
  "None / No religion",
] as const;

/** The sentinel the picker uses; never stored — the typed value is stored. */
export const RELIGION_OTHER = "Others";

/** True when a stored value needs the free-text box open to be shown. */
export const isOtherReligion = (value?: string | null): boolean =>
  !!value && !(RELIGION_OPTIONS as readonly string[]).includes(value);

/**
 * Split a stored value into what the picker should show and what belongs in the
 * free-text box, so an existing record reopens the way it was saved.
 */
export function splitReligion(value?: string | null): { choice: string; other: string } {
  if (!value) return { choice: "", other: "" };
  return isOtherReligion(value)
    ? { choice: RELIGION_OTHER, other: value }
    : { choice: value, other: "" };
}

/** What to store: the typed value when "Others" is picked, else the choice. */
export const resolveReligion = (choice: string, other: string): string =>
  (choice === RELIGION_OTHER ? other : choice).trim();
