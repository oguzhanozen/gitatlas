import { notFound } from "next/navigation";
import { LessonWorkspace } from "@/components/lessons/LessonWorkspace";
import { lessonById, lessons } from "@/content/lessons";
import { lessonIdToSlug, lessonSlugToId } from "@/domain/lessons/lesson-url";

export function generateStaticParams() {
  return lessons.map(lesson => ({ lessonId: lessonIdToSlug(lesson.id) }));
}

export default async function LessonPage({params}:{readonly params:Promise<{lessonId:string}>}){const id=lessonSlugToId((await params).lessonId);const lesson=id?lessonById(id):undefined;if(!lesson)notFound();return <LessonWorkspace key={lesson.id} lesson={lesson}/>}
