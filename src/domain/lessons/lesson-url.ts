const LESSON_SLUG_SEPARATOR = "--";
const LESSON_ID_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function lessonIdToSlug(id: string): string {
  const segments = id.split("/");
  if (segments.length < 2 || segments.some(segment => !LESSON_ID_SEGMENT.test(segment))) {
    throw new Error(`Geçersiz ders kimliği: ${id}`);
  }
  return segments.join(LESSON_SLUG_SEPARATOR);
}

export function lessonSlugToId(slug: string): string | null {
  if (!slug || slug.includes("/") || /%2f/i.test(slug)) return null;
  const segments = slug.split(LESSON_SLUG_SEPARATOR);
  if (segments.length < 2 || segments.some(segment => !LESSON_ID_SEGMENT.test(segment))) return null;
  return segments.join("/");
}

export function lessonHref(id: string): string {
  return `/learn/${lessonIdToSlug(id)}`;
}
