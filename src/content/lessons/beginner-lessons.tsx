/* eslint-disable react/no-unescaped-entities */
import type { LessonDefinition } from "@/domain/lessons/models";
import { makeCommit, type RepositoryState } from "@/domain/git/models";

const emptyRepo: RepositoryState = {
    initialized: true,
    commits: {},
    branches: { main: { name: "main", target: null } },
    head: { kind: "branch", name: "main" },
    workingTree: {
        "merhaba.txt": "GitAtlas'a hoş geldin!\nBu senin ilk dosyan."
    },
    index: { entries: {} },
    tags: {},
    stashes: [],
    remotes: {},
    reflog: [],
    nextCommitNumber: 1,
};

export const workspaceLesson: LessonDefinition = {
    id: "basics/01-workspace",
    title: "Git Repository Nedir?",
    briefing: [
        <p key="1"><b>Git</b>, projendeki değişiklikleri takip eden bir versiyon kontrol sistemidir.</p>,
        <p key="2" className="mt-3">Bir Git klasörü (repository) temel olarak üç ana bölümden oluşur:</p>,
        <ul key="3" className="mt-2 list-disc pl-5 space-y-1">
            <li><b>Working Directory (Çalışma Alanı):</b> Şu an bilgisayarında açık olan ve üzerinde çalıştığın dosyalar buradadır.</li>
            <li><b>Staging Area (Hazırlama Alanı/Index):</b> Bir sonraki commit için seçtiğin dosya sürümlerinin kopyalandığı alandır.</li>
            <li><b>Commit (Kayıt):</b> Index içeriğinin kaydedilmiş anlık görüntüsüdür (snapshot); geçmiş düzenleme komutlarıyla yeniden yazılabilir.</li>
        </ul>,
        <p key="4" className="mt-3">Şu an <i>Working Directory</i> içerisinde <code>merhaba.txt</code> adında bir dosya var ama Git henüz bu dosyayı takip etmiyor (Untracked). Git'in mevcut durumunu görmek için <code>git status</code> komutunu kullanırız.</p>
    ],
    story: "Sisteme yeni bir dosya ekledin ama henüz Git bu dosyayı takip etmiyor. Repository'nin mevcut durumunu kontrol et.",
    goalDescription: "git status komutunu çalıştırarak çalışma alanının durumunu gör.",
    estimatedMinutes: 2,
    allowedCommands: ["git status"],
    hints: [
        "Terminal paneline 'git status' yazıp Enter'a bas."
    ],
    initialRepositoryState: emptyRepo,
    successConditions: [
        { type: "command-executed", family: "status" }
    ],
    explanationAfterSuccess: "Tebrikler! git status komutu sayesinde, merhaba.txt dosyasının 'Untracked' (takip edilmeyen) durumunda olduğunu gördün. Bu, dosyanın Working Directory'de olduğunu ama henüz Git'in kayıt alanına alınmadığını gösterir."
};

export const stagingLesson: LessonDefinition = {
    id: "basics/02-staging",
    title: "Staging Area (Hazırlık Alanı)",
    briefing: [
        <p key="1">Bir commit oluşturmadan önce istediğin dosyaların o anki sürümünü <b>Staging Area</b> (hazırlama alanı/index) içine kopyalarsın. Working tree dosyaları yerinde kalır.</p>,
        <p key="2" className="mt-3">Bunu bir kargo paketi hazırlamaya benzetebilirsin:</p>,
        <ul key="3" className="mt-2 list-disc pl-5 space-y-1">
            <li><b>Working Directory:</b> Eşyalarının dağınık durduğu odan.</li>
            <li><b>Staging Area:</b> Bir sonraki commit snapshot'ına girecek dosya sürümlerini seçtiğin index.</li>
        </ul>,
        <p key="4" className="mt-3">Dosyaları hazırlık alanına eklemek için <code>git add &lt;dosya_adi&gt;</code> komutunu kullanırız.</p>
    ],
    story: "Untracked (takip edilmeyen) merhaba.txt dosyasının güncel sürümünü bir sonraki commit için index'e kopyalaman gerekiyor.",
    goalDescription: "git add merhaba.txt ile dosyanın o anki içeriğini Staging Area'ya (Index) kopyala.",
    estimatedMinutes: 3,
    allowedCommands: ["git status", "git add"],
    hints: [
        "Önce durumu görmek için 'git status' yazabilirsin.",
        "'git add merhaba.txt' komutunu kullanarak dosyanın güncel sürümünü index'e kopyala."
    ],
    initialRepositoryState: emptyRepo,
    successConditions: [
        { type: "file-staged", path: "merhaba.txt" }
    ],
    explanationAfterSuccess: "git add, merhaba.txt dosyasının o anki içeriğini index'e kopyaladı. Working tree dosyası yerinde kaldı; onu yeniden düzenlersen son sürüm için tekrar git add gerekir."
};

const stagedRepo = {
    ...emptyRepo,
    index: { entries: { "merhaba.txt": emptyRepo.workingTree["merhaba.txt"] } }
};

export const commitLesson: LessonDefinition = {
    id: "basics/03-commit",
    title: "İlk Commit'ini Oluştur",
    briefing: [
        <p key="1"><b>Commit</b>, working tree'nin tamamını değil, o anda index'te seçili dosya sürümlerini yeni bir snapshot olarak kaydeder.</p>,
        <p key="2" className="mt-3"><b>Commit</b>, projenin o anki tam bir fotoğrafıdır. Her commit'in nelerin değiştiğini açıklayan bir mesajı olmalıdır.</p>,
        <p key="3" className="mt-3">Commit oluşturmak için <code>git commit -m "mesaj buraya"</code> komutunu kullanırız. <code>-m</code> seçeneği "message" anlamına gelir.</p>
    ],
    story: "Index'teki merhaba.txt sürümü için bir commit oluşturma zamanı geldi. Böylece geçmişte adreslenebilir, kaydedilmiş bir snapshot oluşacak.",
    goalDescription: "git commit -m \"ilk commit\" komutu ile ilk commit'ini oluştur.",
    estimatedMinutes: 3,
    allowedCommands: ["git status", "git commit"],
    hints: [
        "Mesaj kısmına tırnak işaretleri arasında bir şeyler yazmalısın. Örneğin: git commit -m \"merhaba kelimesi eklendi\""
    ],
    initialRepositoryState: stagedRepo,
    successConditions: [
        { type: "commit-count", count: 1 }
    ],
    explanationAfterSuccess: "C1 commit'i index içeriğini kaydetti. Bu noktaya dönebilirsin; ancak reset/rebase/amend gibi geçmiş düzenleme işlemlerinin commit kimliklerini değiştirebileceğini unutma."
};

const committedRepo: RepositoryState = {
    initialized: true,
    commits: {
        C0: makeCommit("C0", "ilk commit", [], { "merhaba.txt": "GitAtlas'a hoş geldin!\nBu senin ilk dosyan." }, "init")
    },
    branches: { main: { name: "main", target: "C0" } },
    head: { kind: "branch", name: "main" },
    workingTree: { "merhaba.txt": "GitAtlas'a hoş geldin!\nBu senin ilk dosyan." },
    index: { entries: {} },
    tags: {}, stashes: [], remotes: {}, reflog: [], nextCommitNumber: 1,
};

export const logLesson: LessonDefinition = {
    id: "basics/04-log",
    title: "Geçmişi İncelemek: Git Log",
    briefing: [
        <p key="1">Projende yapılan tüm commit'leri (paketleri) bir kronolojik defter gibi düşün. <b>Git Log</b>, bu defteri okumanı sağlar.</p>,
        <p key="2" className="mt-3"><code>git log</code> komutu, projendeki geçmiş commit'leri en yeniden en eskiye doğru listeler.</p>,
        <p key="3" className="mt-3">Her kayıt, o commit'in benzersiz ID'sini (hash), kim tarafından yapıldığını, tarihini ve mesajını içerir.</p>
    ],
    story: "Projende daha önceden oluşturulmuş bir commit var. Acaba bu commit ne zaman atıldı ve içeriğinde ne var?",
    goalDescription: "Geçmişi görmek için `git log` komutunu çalıştır.",
    estimatedMinutes: 2,
    allowedCommands: ["git status", "git log"],
    hints: [
        "Sadece `git log` yazıp enter'a bas."
    ],
    initialRepositoryState: committedRepo,
    successConditions: [
        { type: "command-executed", family: "log" }
    ],
    explanationAfterSuccess: "Tebrikler! git log komutu ile projendeki tüm commit geçmişini görüntüleyebilirsin. Proje geliştikçe burada bir sürü kayıt göreceksin."
};

export const diffLesson: LessonDefinition = {
    id: "basics/05-diff",
    title: "Değişiklikleri Görmek: Git Diff",
    briefing: [
        <p key="1">Kod üzerinde bir şeyler değiştirdin, fakat tam olarak hangi satırları eklediğini veya sildiğini hatırlamıyorsun.</p>,
        <p key="2" className="mt-3">Bu durumda imdadına <b>git diff</b> komutu yetişir. <code>git diff</code> komutu sana <b>Working Directory</b> (şimdi bulunduğun hal) ile önceki hal arasındaki farkı satır satır gösterir.</p>,
        <p key="3" className="mt-3">Eklenen kodlar <span className="text-[var(--success)] font-bold">+</span> ile, silinen kodlar <span className="text-[var(--danger)] font-bold">-</span> ile gösterilir.</p>
    ],
    story: "merhaba.txt dosyasını index'e kopyaladıktan sonra working tree'de yeniden düzenledin. git diff ile working tree ↔ index farkını incele.",
    goalDescription: "git status ile değişen dosyayı gör, sonrasında git diff yazarak nelerin değiştiğini incele.",
    estimatedMinutes: 4,
    allowedCommands: ["git status", "git diff", "git add"],
    hints: [
        "Değişiklikleri görmek için 'git diff' komutuna ihtiyacın var."
    ],
    initialRepositoryState: {
        ...committedRepo,
        workingTree: { "merhaba.txt": "GitAtlas'a hoş geldin!\nBu senin ilk dosyan.\nBir satir daha eklendi!" }
    },
    successConditions: [
        { type: "command-executed", family: "diff-working" }
    ],
    explanationAfterSuccess: "Çok iyi! `git diff` sana yapacağın commit öncesi kodunun neresine ne eklendiğini açıkça gösterir. Bu, yanlışlıkla projeye zarar vermeni engellemek için mükemmel bir yöntemdir."
};

export const beginnerLessons = [
    workspaceLesson,
    stagingLesson,
    commitLesson,
    logLesson,
    diffLesson
];
