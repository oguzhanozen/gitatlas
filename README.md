# GitAtlas

GitAtlas, Git komutlarını ezberletmek yerine çalışma ağacı (working tree), hazırlama alanı (staging area/index), HEAD snapshot, branch ve commit graph ilişkisini öğreten Türkçe, tarayıcı tabanlı bir eğitim simülasyonudur. Gerçek shell, Git binary, dosya sistemi veya ağ isteği çalıştırmaz.

## Çalışan eğitim kapsamı

- 8 bölümde mevcut kimlikleri korunan 29 ders: 6 kavram aktivitesi ve 23 terminal görevi.
- 7 bölüm sonu mastery ve 3 hata-kurtarma olmak üzere 10 ayrı ipucusuz değerlendirme. Mastery sonucu normal ders tamamlama/rozet ilerlemesinden ayrıdır.
- Working tree → index → commit modeli; `git diff`, `git diff --staged` ve `git diff HEAD` karşılaştırmaları.
- Branch oluşturma/değiştirme, fast-forward, ortak ata tabanlı dosya düzeyinde three-way merge, conflict çözme ve `merge --abort`.
- Yerel branch, remote repository branch ve remote-tracking ref ayrımı; gerçek state değişimli fetch, pull ve non-fast-forward push reddi.
- Restore, reset, revert, reflog, stash save/apply/pop, amend, rebase ve cherry-pick eğitim semantiği.
- Gerçek terminale geçiş kontrol listesi, iki dilli sözlük, ilerlemeden yalıtılmış sandbox, yerel istatistik ve açıklanabilir aralıklı tekrar.
- Zod doğrulamalı, boyut sınırlı JSON ilerleme dışa/içe aktarma ve açık onaylı sıfırlama.

GitAtlas'ın amacı gerçek Git'in bütün edge-case'lerini kopyalamak değildir. Simülasyonun sınırları kullanıcıya açıkça gösterilir:

- Three-way merge dosyayı atomik birim kabul eder. Gerçek Git aynı dosyadaki farklı satırları otomatik birleştirebilir.
- Normal merge conflict lifecycle tamdır; rebase, cherry-pick ve squash sırasında oluşan conflict'ler güvenli biçimde durdurulur ve kavramsal sınır olarak açıklanır.
- `blame`/path log dersi kavramsal demodur; gerçek Git'in yazar, tarih, rename ve satır kökeni çözümlemesini taklit ettiği iddia edilmez.
- Clone/config/remote URL'leri eğitim state'idir; ağ, credential veya kullanıcı yapılandırması üzerinde etkisi yoktur.

## Terminoloji ve durum modeli

`git add`, dosyayı başka yere taşımaz. Dosyanın o andaki working tree içeriğini index'e kopyalar; dosya working tree'de kalır ve sonraki düzenleme için yeniden add gerekir.

```text
git diff --staged: HEAD snapshot ↔ effective index
git diff:          effective index ↔ working tree
git diff HEAD:     HEAD snapshot ↔ working tree
```

Commit yalnız effective index snapshot'ını kaydeder; unstaged working tree değişikliklerini korur. `RepositoryState.index.entries`, HEAD'e göre delta tutar: `string` yeni/değişmiş içeriği, `null` staged silmeyi temsil eder.

Remote modelinde üç farklı referans vardır:

1. `RemoteState.branches`: uzak repository'nin branch ref'i.
2. `RepositoryState.remoteTracking`: son fetch'te görülen `origin/main` benzeri yerel izleme ref'i.
3. `RepositoryState.branches`: kullanıcının aktif/yerel branch'i.

Fetch uzak commit nesneleri ve remote-tracking ref'i günceller; local branch, index ve working tree'yi değiştirmez. Pull, fetch + entegrasyondur ve up-to-date, fast-forward, divergence/merge ile conflict yollarını kullanır. Push yalnız uzak uç yerel hedefin atasıysa fast-forward günceller.

Conflict durumunda model ortak ata, ours, theirs, MERGE_HEAD eşdeğeri, merge öncesi working tree/index ve conflict listesini saklar. Kullanıcı marker'ları güvenli textarea'da düzenler, `git add` ile resolved işareti verir; çözülmemiş dosya varken commit engellenir. Final merge commit iki parent taşır. `git merge --abort` pre-merge state'i geri yükler.

## Eğitim yüzeyleri

- `/learn`: 8 bölüm/29 ders ve görünür önkoşullar.
- `/assessments`: yeni bağlamlı, ipucusuz state + davranış sırası mastery görevleri.
- `/sandbox`: preset state'ler üzerinde serbest komut; `completeLesson` veya ilerleme sonucu yazmaz.
- `/glossary`: Türkçe/İngilizce tanım, örnek ve ilgili ders bağlantıları.
- `/real-terminal`: örnek kimlik değerleriyle init/clone/remote add/ilk commit/ilk push/default branch kontrol listeleri.
- `/stats`: yalnız bu tarayıcıdaki tamamlanma, deneme, hata, tekrar önerisi ve veri yönetimi.

Öğrenme haritasındaki kilitler önerilen pedagojik sırayı gösterir ve eksik bölümleri adlandırır. Statik hosting, bookmark ve refresh uyumluluğu için doğrudan ders URL'leri bilinçli olarak erişilebilir tutulur; bu bir yetkilendirme sınırı değildir.

## Yerel veri ve güvenlik

`gitatlas:progress` v4 şeması yalnız tamamlanan ders kimlikleri, en iyi ipucu sayıları, son ders, bounded sonuçlar ve ders başına anonim öğrenme sayaçları/tarihlerini tutar. Tema yalnız ayrı `gitatlas:theme` anahtarındadır.

- v1, v2 ve v3 verileri v4'e migrate edilir; bozuk/bilinmeyen veri güvenli boş state'e döner.
- Sonuçlar ders başına tekilleştirilir ve 100 kayıtla sınırlıdır.
- Storage okuma/yazma/quota hataları kullanıcı akışını çökertmez.
- Import, JSON parse öncesinde 1 MiB ile sınırlanır; Zod şeması/migration geçmeyen veri reddedilir.
- Export şeması terminal komutu, repository dosya içeriği, ad, e-posta, parola veya token içermez.
- Kullanıcı metinleri React text node/textarea olarak render edilir; `dangerouslySetInnerHTML`, `eval`, dinamik script, tracker, telemetry veya CDN yoktur.
- Static export için doğrulanmamış bir CSP güvenlik iddiası yapılmaz; Next.js boot scriptleriyle uyumlu bir CSP ayrıca deploy ortamında test edilmelidir.

## Kurulum ve kalite komutları

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm audit --omit=dev
```

Playwright tarayıcısı yoksa bir kez `npx playwright install chromium` çalıştırın.

## Statik export ve GitHub Pages

`next.config.ts`, `output: "export"` ve `trailingSlash: true` kullanır. `npm run build`, deploy edilebilir `out/` klasörünü üretir. Dinamik ders parametreleri build sırasında statik olarak oluşturulur; API route, Server Action, middleware, cookie veya server runtime yoktur.

Project Pages için:

```powershell
$env:NEXT_PUBLIC_BASE_PATH='/repo-adi'
npm run build
```

Root site build'inde değişken boş bırakılır. `NEXT_PUBLIC_BASE_PATH` yalnız güvenli URL path biçimini kabul eder. `.github/workflows/pages.yml`, pull requestlerde kalite kapılarını; ana branch'te aynı kapılar sonrası minimum Pages izinleriyle export/upload/deploy akışını çalıştırır.

## Mimari

```text
src/domain/git/        immutable repository modeli, parser, merge ve command engine
src/domain/lessons/    state + session/event tabanlı başarı koşulları
src/content/           29 ders, mastery değerlendirmeleri ve başlangıç state'leri
src/components/        terminal, graph, repository/conflict, lesson, sandbox ve assessment UI
src/persistence/       v4 Zod şeması, migration, repetition, güvenli import/export
src/app/               yalnız statik App Router sayfaları
e2e/                   Playwright öğrenme, conflict, remote, keyboard, mobile ve izolasyon akışları
```

Undo, mutation yapan komuttan önceki tam `RepositoryState` snapshot'ını geri yükler. Ders başarıları yalnız komut metnine dayanmaz; state koşulları ve gerekli davranış sırası birlikte değerlendirilir. Mevcut 29 ders ID'si migration/bookmark uyumu için sabittir.
