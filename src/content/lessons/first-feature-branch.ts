import { createLessonRepository } from "@/domain/git/models";
import type { LessonDefinition } from "@/domain/lessons/models";

export const firstFeatureBranchLesson: LessonDefinition = {
  id: "branching/first-feature-branch",
  title: "İlk Feature Branch",
  story: "Pusula API'nin oturum özelliğini main dalını riske atmadan geliştireceksin.",
  goalDescription: "feature/login adlı bir branch oluştur ve HEAD'i bu branch'e taşı.",
  estimatedMinutes: 4,
  allowedCommands: ["git branch", "git switch", "git checkout", "git status", "git log"],
  hints: ["Branch bir commit kopyası değil, commit'i gösteren bir işaretçidir.", "Hem branch oluşturup hem ona geçebilen switch veya checkout seçeneğini düşün.", "Örnek biçim: git switch -c <branch-adı>"],
  initialRepositoryState: createLessonRepository(),
  successConditions: [{ type: "branch-exists", name: "feature/login" }, { type: "head-on-branch", name: "feature/login" }],
  explanationAfterSuccess: "feature/login ve main aynı commit'i gösteriyor; fark, HEAD'in feature/login üzerinde olması. Yeni commit geldiğinde yalnızca aktif branch ilerleyecek.",
};
