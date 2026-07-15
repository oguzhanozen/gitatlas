import Link from "next/link";

const Command = ({ children }: { readonly children: string }) => <code className="block overflow-x-auto rounded-lg bg-[var(--terminal)] px-3 py-2 text-sm text-[#d9e9e3]">{children}</code>;

export default function RealTerminalPage() {
  return <main className="mx-auto max-w-4xl px-5 py-10 md:px-8 md:py-14">
    <Link href="/learn" className="text-sm font-bold text-[var(--text-2)]">← Öğrenme haritası</Link>
    <p className="mt-8 text-xs font-black uppercase tracking-[.2em] text-[var(--success)]">Simülasyondan gerçek Git&apos;e geçiş</p>
    <h1 className="mt-3 text-4xl font-black">Gerçek terminal kontrol listesi</h1>
    <p className="mt-4 leading-7 text-[var(--text-2)]">GitAtlas hiçbir komutu işletim sisteminde çalıştırmaz. Aşağıdaki örnekleri kendi terminalinde, deneme klasöründe uygula. Gerçek ad, e-posta, parola veya token değerlerini GitAtlas&apos;a girme; uygulama bunları istemez ve saklamaz.</p>
    <div className="mt-8 grid gap-6 md:grid-cols-2">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="text-xl font-black">1. Kimlik ve varsayılan dal</h2><p className="mt-2 text-sm leading-6 text-[var(--text-2)]">Aşağıdaki değerler yalnız güvenli örnektir. Kendi terminalinde uygun değerleri kullan.</p><div className="mt-4 space-y-2"><Command>git config --global user.name &quot;Örnek Kullanıcı&quot;</Command><Command>git config --global user.email &quot;kullanici@example.invalid&quot;</Command><Command>git config --global init.defaultBranch main</Command><Command>git config --global --list</Command></div></section>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="text-xl font-black">2. Yeni klasörden ilk push</h2><p className="mt-2 text-sm text-[var(--text-2)]">Önce editörünle <code>README.md</code> oluştur ve içine <code># Deneme</code> yaz. Sonra <code>.gitignore</code> oluşturup ilk satıra <code>node_modules/</code> ekle.</p><div className="mt-4 space-y-2"><Command>mkdir deneme-repo</Command><Command>cd deneme-repo</Command><Command>git init</Command><Command>git status</Command><Command>git add README.md .gitignore</Command><Command>git diff --staged</Command><Command>git commit -m &quot;ilk commit&quot;</Command><Command>git remote add origin https://example.invalid/ornek/deneme.git</Command><Command>git push -u origin main</Command></div></section>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="text-xl font-black">3. Var olan depoyu clone et</h2><div className="mt-4 space-y-2"><Command>git clone https://example.invalid/ornek/deneme.git</Command><Command>cd deneme</Command><Command>git remote -v</Command><Command>git branch --show-current</Command><Command>git status</Command></div></section>
      <section className="rounded-2xl border border-[var(--warning)] bg-[var(--surface)] p-5"><h2 className="text-xl font-black">Simülasyon farkları</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[var(--text-2)]"><li>Gerçek Git dosya sistemi ve ağ kullanır; GitAtlas yalnız bellekteki eğitim state&apos;ini değiştirir.</li><li>Gerçek hosting servisi kimlik doğrulama isteyebilir. Parola/token üretme ve saklama bu öğreticinin kapsamı dışındadır.</li><li>GitAtlas file-level three-way öğretir; gerçek Git aynı dosyada farklı satırları da otomatik birleştirebilir.</li><li>Komuttan önce <code>pwd</code> ve <code>git status</code> ile klasörü/durumu doğrula.</li></ul></section>
    </div>
  </main>;
}
