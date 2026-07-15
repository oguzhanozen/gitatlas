import type { LessonDefinition } from "@/domain/lessons/models";
import { chapters, curriculumLessons } from "./curriculum";

export { chapters };
export const lessons: readonly LessonDefinition[] = curriculumLessons;
export const lessonById = (id: string): LessonDefinition | undefined => lessons.find(lesson => lesson.id === id);
