# Flow Prompt Studio CLI

**Senaryodan Google Flow / Veo AI prompt paketi üretici**

Bir senaryo dosyası verin; karakter analizi, görsel stil tespiti, kamera coverage planı, shot planı, asset planı, AI prompt paketi, repair promptları, copy-ready Flow blokları ve tüm export formatlarını otomatik üretsin.

## Kurulum

```bash
npm install -g flow-prompt-studio
```

## Gereksinimler

- Node.js >= 18
- Flow Prompt Studio Backend (`http://localhost:8000`)
- DeepSeek API Key (`.env` dosyasında)

## Hızlı Başlangıç

```bash
# Backend durumunu kontrol et
fps config

# Senaryoyu yükle ve tam workflow çalıştır
fps workflow senaryom.pdf

# Sadece analiz yap
fps upload senaryom.pdf
fps analyze

# AI prompt paketi üret
fps generate --ultra
```

## Komutlar

| Komut | Açıklama |
|-------|----------|
| `fps config` | Backend durumu ve API key kontrolü |
| `fps upload <dosya>` | Senaryo yükle (.txt, .md, .pdf, .docx) |
| `fps analyze` | Karakter, mekan, prop çıkarımı |
| `fps style` | Görsel stil tespiti (AI veya fallback) |
| `fps generate` | AI prompt paketi üret |
| `fps coverage` | Kamera coverage ve shot planı |
| `fps repair [tür]` | Onarım promptu üret |
| `fps validate` | Paket doğrulama |
| `fps preview` | Markdown önizleme |
| `fps export [format]` | Dışa aktarma (14 format) |
| `fps workflow <dosya>` | **Tam otomatik 7 adımlı workflow** |

## Workflow

`fps workflow senaryo.pdf` komutu şu adımları sırayla çalıştırır:

1. 📤 Senaryo yükleme
2. 🔍 Karakter, mekan, prop analizi
3. 🎨 Görsel stil tespiti
4. 📷 Kamera coverage planı (194 shot / 18 sahne)
5. 🤖 AI prompt paketi üretimi (opsiyonel)
6. ✅ Paket doğrulama
7. 📦 Dışa aktarma (6 format)

## Programmatic API

```javascript
const { FlowPromptStudio } = require('flow-prompt-studio');
const fps = new FlowPromptStudio();

// Tam otomatik
const result = await fps.workflow('senaryo.pdf', { ultra: true });

// Manuel kontrol
await fps.upload('senaryo.pdf');
const { analysis } = await fps.analyze();
const style = await fps.detectStyle();
const bundle = await fps.getCoverage();
const gen = await fps.generate('full_pack', true);
const validation = await fps.validate();
const url = await fps.getExportUrl('production-pack-zip');
```

## Claude Code Skill

Bu paket Claude Code ile kullanılabilir. `skills/flow-prompt-studio.md` dosyası Claude Code'un bu aracı bir skill olarak tanımasını sağlar.

## Lisans

MIT
