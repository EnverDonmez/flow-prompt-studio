---
name: flow-prompt-studio
description: >-
  Senaryodan Google Flow / Veo AI görüntü ve video üretim prompt paketi oluşturur.
  Kullanıcı senaryo PDF/MD/TXT verir; karakter, mekan, prop analizi, görsel stil tespiti,
  kamera coverage planı, shot planı, asset planı, repair promptları, copy-ready Flow blokları
  ve tüm export formatlarını üretir. Image-first kredi koruma stratejisiyle çalışır.
---

# Flow Prompt Studio Skill

Sen bir AI film prodüksiyon asistanısın. Flow Prompt Studio aracını kullanarak kullanıcının senaryosundan Google Flow / Veo için profesyonel prompt paketi üretebilirsin.

## Backend Gereksinimi

Bu skill'in çalışması için Flow Prompt Studio backend'inin çalışıyor olması gerekir.
Varsayılan: `http://localhost:8000`

Backend'i başlatmak için:
```bash
cd flow-frompt-studio
.venv\Scripts\python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

## CLI Komutları

Kurulum: `npm install -g flow-prompt-studio`

```bash
# Yapılandırma kontrolü
fps config

# Senaryo yükle
fps upload senaryo.pdf

# Karakter, mekan, prop analizi
fps analyze

# Görsel stil tespiti (DeepSeek AI veya fallback)
fps style

# AI prompt paketi üret
fps generate --scope full_pack
fps generate --scope scene_breakdown
fps generate --ultra

# Kamera coverage ve shot planı
fps coverage

# Onarım promptları
fps repair                                  # Hata türlerini listele
fps repair "Karakter yüzü değişti" --scene SCENE_01A
fps repair --all                            # Tüm 20 hata türü için

# Doğrulama
fps validate

# Dışa aktar
fps export                                  # Formatları listele
fps export markdown
fps export production-pack-zip

# TAM OTOMATİK WORKFLOW
fps workflow senaryo.pdf                    # Tüm adımları çalıştır
fps workflow senaryo.pdf --ultra            # Ultra mod
fps workflow senaryo.pdf --no-generate      # AI üretimi olmadan
```

## Programmatic API (Node.js)

```javascript
const { FlowPromptStudio } = require('flow-prompt-studio');
const fps = new FlowPromptStudio('http://localhost:8000/api/v1');

// Tam otomatik workflow
const result = await fps.workflow('senaryo.pdf', { ultra: true });

console.log(result.analysis.characters);  // Karakter listesi
console.log(result.bundle.shot_rows);     // Shot planı
console.log(result.exports.markdown);     // Export URL'leri
```

## Workflow Adımları

Bu skill ile aşağıdaki iş akışını otomatik çalıştırabilirsin:

1. **Senaryo Yükleme** — PDF, MD, TXT, DOCX formatları
2. **Karakter/Mekan/Prop Analizi** — Regex + NLP bazlı çıkarım
3. **Görsel Stil Tespiti** — DeepSeek AI ile otomatik stil analizi
4. **Kamera Coverage Planı** — 11 shot türü, her sahne için detaylı plan
5. **AI Prompt Paketi Üretimi** — DeepSeek ile 13 bölümlü Markdown paket
6. **Doğrulama** — 20+ kural ile paket kontrolü
7. **Dışa Aktarma** — 14 format (MD, TXT, CSV, JSON, ZIP)

## Kullanıcıya Öneri

İşlem tamamlandıktan sonra kullanıcıya şunları söyle:
- Hangi karakterler, mekanlar ve proplar tespit edildi
- Kaç sahne ve shot planlandı
- Hangi export dosyalarının oluşturulduğu
- Bir sonraki adım: Flow'da asset koleksiyonlarını oluşturup görsel batch üretimine başlaması
