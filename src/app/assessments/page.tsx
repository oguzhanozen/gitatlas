import Link from "next/link";
import { AssessmentLab } from "@/components/assessments/AssessmentLab";
import { assessments } from "@/content/assessments";
export default function AssessmentsPage(){return <main className="mx-auto max-w-7xl px-3 py-10 md:px-6"><Link href="/learn" className="text-sm font-bold text-[var(--text-2)]">← Öğrenme haritası</Link><h1 className="mt-7 text-4xl font-black">Bölüm sonu değerlendirmeleri</h1><p className="mt-3 max-w-3xl leading-7 text-[var(--text-2)]">Yeni bağlamlarda, doğrudan çözüm ve ipucu olmadan state + davranış sırası ölçülür. Normal ders tamamlamasıyla mastery sonucu ayrı tutulur.</p><div className="mt-8 space-y-8">{assessments.map(item=><AssessmentLab key={item.id} assessment={item}/>)}</div></main>}
