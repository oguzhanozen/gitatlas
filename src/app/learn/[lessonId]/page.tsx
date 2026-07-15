import { notFound } from "next/navigation";
import { LessonWorkspace } from "@/components/lessons/LessonWorkspace";
import { lessonById, lessons } from "@/content/lessons";

export function generateStaticParams() {
  return lessons.map(lesson => ({ lessonId: lesson.id }));
}

export default async function LessonPage({params}:{readonly params:Promise<{lessonId:string}>}){const{id}= {id:decodeURIComponent((await params).lessonId)};const lesson=lessonById(id);if(!lesson)notFound();return <LessonWorkspace key={lesson.id} lesson={lesson}/>}
