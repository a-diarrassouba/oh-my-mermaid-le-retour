[English](./README.md) | [Türkçe](./README.tr.md) | [한국어](./README.ko.md) | [日本語](./README.ja.md) | [中文](./README.zh.md)

> Bu belge İngilizce README'den çevrilmiştir. Bazı ifadeler doğal olmayabilir.

<h1 align="center">prisme</h1>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"/></a>
</p>

<p align="center">
  Bir prizma beyaz ışığı net renklere ayırır.<br/>
  <strong>prisme, karmaşık bir projeyi yeni başlayandan kıdemli geliştiriciye kadar herkesin anlayabileceği parçalara ayırır.</strong>
</p>

---

## Hızlı Başlangıç

prisme henüz npm'de değil. Kaynaktan kurun, ardından becerilerini AI kodlama araçlarınıza kaydedin:

```bash
git clone https://github.com/a-diarrassouba/oh-my-mermaid-le-retour.git prisme
cd prisme && npm install && npm link
prisme setup
```

Daha sonra `prisme update` bu klonu güncelleyip yeniden derler.

Anlamak istediğiniz projede belgelerin dilini seçin (isteğe bağlı, varsayılan İngilizce):

```bash
prisme config language fr
```

Ardından o projede AI kodlama aracınızı açın ve `/prisme-scan` becerisini çalıştırın:

```
/prisme-scan
```

Sonucu görüntüleyin ve görüntüleyicinin önerdiği karşılama rehberini izleyin:

```bash
prisme view
```

## Nasıl Çalışır

Yapay zekanız kod tabanını okur ve **perspective**'ler yazar — projeye farklı bakış açıları: ne yaptığı ve kimin için olduğu, nasıl kurulduğu, verilerin nasıl aktığı, nasıl korunduğu, nasıl çalıştırılıp test edilip yayınlandığı ve şu anki durumu. Her perspective, seçtiğiniz dilde bir Mermaid diyagramı ve dokümantasyon alanları içerir.

Her element **özyinelemeli olarak analiz edilir**. Karmaşık olanlar kendi diyagramlarına sahip iç içe elementlere dönüşür; basit olanlar yaprak olarak kalır. Dosya sistemi ağacı yansıtır:

```
.prisme/
├── functional-overview/            ← perspective
├── overall-architecture/
│   ├── description.md
│   ├── diagram.mmd
│   ├── context.md
│   ├── main-process/               ← iç içe element
│   │   ├── description.md
│   │   ├── diagram.mmd
│   │   └── auth-service/           ← daha derin iç içe yapı
│   │       └── ...
│   └── renderer/
│       └── ...
├── data-flow/
├── operations/
├── project-status/
└── .guides/                        ← rehberler (adım adım gezintiler)
```

Görüntüleyici iç içe yapıyı dosya sisteminden otomatik algılar — alt öğesi olan elementler genişletilebilir gruplar olarak, diğerleri düğüm olarak gösterilir.

Her element en fazla 7 alan (`description`, `diagram`, `context`, `constraint`, `concern`, `todo`, `note`) ve bir görünen başlık taşır.

### Rehberler

**Rehber**, diyagramlar üzerinde adım adım bir gezintidir: görüntüleyici her elementi açar, geri kalanını soluklaştırır ve izlenen bağlantıyı vurgular. AI aracınızda `/prisme-guide` ile bir tane isteyin (örneğin `/prisme-guide bir kullanıcı kaydolduğunda ne olur?`). `/prisme-scan` ayrıca üç bölümlük bir karşılama rehberi, `start-here`, yazar (proje ne yapar, nasıl kurulmuştur, nasıl çalıştırılır, test edilir ve yayınlanır); görüntüleyici bunu ilk ziyarette önerir. Rehberler `.prisme/.guides/` içinde saklanır ve yeni bir tarama bir rehberi bozduğunda `prisme validate` bunu bildirir.

### Sorular

Görüntüleyicinin soru çubuğuna istediğiniz soruyu yazın (örneğin "`prisme write` çalıştırınca ne olur?" veya "oturum nerede kontrol ediliyor?"). Claude Code diyagram üzerinde yanıtlar: okları izleyerek yolu çizer, bakılacak blokları vurgular ya da dosyayı ilgili satırlarda açar; her adımın bir açıklaması vardır. Bu sırada sorunuzdaki kelimelerle eşleşen elementler vurgulanır. Yanıtlar sol paneldeki "Sorularınız" bölümünde saklanır.

Bunun için `prisme view` çalıştıran makinede Claude Code kurulu ve oturum açılmış olmalıdır (`claude`, ardından `/login`); görüntüleyiciyi yalnızca açanlar için hiçbir şey gerekmez. Claude projeyi yalnızca okur (`.env` dosyalarını veya anahtarları asla okumaz), hiçbir şeyi değiştirmez. `prisme view --no-ai` soruları kapatır.

Ana ekrandaki güvenlik kutucuğu tek tıkla puanı hesaplar: bilinen riskleri (gizli anahtarlar, riskli kod, OpenSSF Scorecard tarzında CI ve bağımlılık düzeni) otomatik olarak kontrol eder, her bulguya OWASP Top 10 kategorisini ekler; hiçbir şey kurmak gerekmez. Ardından `/prisme-security` ile Claude her bulguyu inceler.

## CLI

```bash
prisme setup                       # Becerileri AI araçlarınıza kaydedin
prisme view                        # Görüntüleyiciyi açın: seviyenizi seçin, ardından üç alan (harita /map adresinde)
prisme view --no-ai                # Claude Code'a soru sormadan açın (API: docs/api.md)
prisme config language fr          # Belgelerin ve arayüzün dilini ayarlayın
prisme guide list                  # Rehberleri listele
prisme changes                     # Son taramadan bu yana değişenler
prisme security                    # Otomatik kontrollerle güvenlik notu A–E (kuruluysa gitleaks, osv-scanner, semgrep kullanılır)
prisme security threats show       # /prisme-security tarafından yazılan tehdit modeli (element başına STRIDE) ve tasarım soruları
prisme evolve show                 # /prisme-evolve tarafından yazılan geliştirme fikirleri
prisme update                      # En son sürüme güncelleyin
```

Tam komut listesi için `prisme help` çalıştırın.

## Beceriler

Beceriler, **AI kodlama aracınızın içinde** (terminalde değil) çalıştırdığınız komutlardır. `/` ile başlarlar.

| Beceri | Ne yapar |
| --- | --- |
| `/prisme-scan` | Kod tabanını analiz eder → belgeleri ve karşılama rehberini yazar |
| `/prisme-guide` | Bir soruyu yanıtlayan adım adım rehber yazar → görüntüleyicide oynatılır |
| `/prisme-security` | `prisme security` çalıştırır, notu sade bir dille açıklar, her bulguyu kontrol eder ve onayladıklarınızı düzeltir; haritanın tehdit modelini (element başına STRIDE) ve güvenli tasarım sorularını yazar |
| `/prisme-evolve` | Kodu sadeleştirme, hızlandırma ve ileri taşıma fikirleri; 3-5 benzer ürünün özellik ve tasarım karşılaştırması |
| `/prisme-view` | Görüntüleyiciyi açar |

## Desteklenen AI Araçları

| Platform | Kurulum |
| --- | --- |
| Claude Code | `prisme setup claude` |
| Codex | `prisme setup codex` |
| Cursor | `prisme setup cursor` |
| OpenClaw | `prisme setup openclaw` |
| Antigravity | `prisme setup antigravity` |

Kurulu tüm araçları otomatik algılayıp yapılandırmak için `prisme setup` çalıştırın.

## Geliştirme ve Katkı

```bash
git clone https://github.com/a-diarrassouba/oh-my-mermaid-le-retour.git
cd oh-my-mermaid-le-retour
npm install && npm run build
npm test
```

Issue ve PR'lar memnuniyetle karşılanır. [Conventional Commits](https://www.conventionalcommits.org/) kullanın.

## Teşekkürler

prisme, yazarları tarafından MIT lisansıyla yayımlanan [oh-my-mermaid](https://github.com/oh-my-mermaid/oh-my-mermaid) projesinin bir çatalı olarak başladı.

## Lisans

[MIT](./LICENSE)
