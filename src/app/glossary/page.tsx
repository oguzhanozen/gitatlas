import Link from "next/link";
import { lessonHref } from "@/domain/lessons/lesson-url";

const terms = [
  ["Working tree", "Çalışma ağacı", "Dosyaları düzenlediğin güncel proje görünümü.", "git status", "basics/01-workspace"],
  ["Index / staging area", "Index / hazırlama alanı", "Bir sonraki commit için seçilen dosya sürümlerinin kopyası.", "git add README.md", "basics/02-staging"],
  ["HEAD", "HEAD", "Bulunduğun branch'in güncel commit'ini veya detached durumda doğrudan commit'i gösteren referans.", "git show HEAD", "history/3-3-show"],
  ["Branch", "Dal", "Bir commit'e işaret eden ve yeni commitlerle ilerleyen hafif referans.", "git switch -c feature", "branching/4-2-create-switch"],
  ["Remote", "Uzak depo bağlantısı", "Başka bir repository kopyasına verilen ad ve URL eşlemesi.", "git remote add origin …", "remotes/6-1-concept"],
  ["Remote-tracking branch", "Uzak dalı izleyen yerel referans", "Son fetch'te görülen origin/main gibi uzak dal konumu; local main değildir.", "git fetch origin main", "remotes/6-3-fetch-pull"],
  ["Merge base", "Ortak ata", "İki geçmişin three-way karşılaştırmasında base olarak kullanılan ortak commit.", "git merge feature", "merging/5-2-three-way"],
  ["Conflict", "Birleştirme çakışması", "Base'e göre ours ve theirs aynı dosyayı farklı değiştirdiğinde insan kararı isteyen durum.", "git status", "merging/5-3-conflict"],
  ["Rebase", "Yeniden tabanlama", "Commit değişikliklerini yeni bir parent zinciri üzerinde yeniden oluşturan geçmiş düzenleme işlemi.", "git rebase main", "advanced/8-3-rebase"],
  ["Reflog", "Referans günlüğü", "HEAD ve branch hareketlerinin yerel kurtarma günlüğü.", "git reflog", "advanced/8-2-edit-history"],
] as const;

export default function GlossaryPage() { return <main className="mx-auto max-w-5xl px-5 py-10 md:px-8"><Link href="/learn" className="text-sm font-bold text-[var(--text-2)]">← Öğrenme haritası</Link><h1 className="mt-8 text-4xl font-black">Git sözlüğü</h1><p className="mt-3 text-[var(--text-2)]">Türkçe zihinsel model ile gerçek Git&apos;in İngilizce terimleri arasında hızlı köprü.</p><dl className="mt-8 grid gap-4 md:grid-cols-2">{terms.map(([english,turkish,definition,example,lesson])=><div key={english} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><dt className="text-lg font-black">{english} <span className="text-[var(--accent)]">· {turkish}</span></dt><dd className="mt-2 text-sm leading-6 text-[var(--text-2)]">{definition}</dd><code className="mt-3 block rounded-lg bg-[var(--bg)] p-2 text-xs">{example}</code><Link className="mt-3 inline-block text-sm font-bold text-[var(--success)]" href={lessonHref(lesson)}>İlgili derse git →</Link></div>)}</dl></main>; }
