# Değişiklik günlüğü

## v1.1 · Kasım 2026

Oyunun kuralları, görevleri, muhafız yapay zekası ve kayıt verisi değişmedi; eski kayıtla açılış çalışıyor.

### Yeni
- **Gece Defteri:** ana ekrandan açılır. Tamamlanan her görev için yıldızlar ve en iyi süre, ayrıca toplam yakalanma, atılan taş, söndürülen fener ve sarayda geçen süre. Veri yalnız bu cihazda, yeni `arena.topkapi.stats` anahtarında tutulur.
- **Sürüm etiketi ve Yenilikler penceresi:** ana ekranda "v1.1 · Kasım 2026"; dokununca bu sürümün maddeleri açılır. Ayarlar'dan da ulaşılır.
- **Ekran sarsıntısı ve titreşim:** yakalanınca ve vazo kırılınca kısa kamera sarsıntısı ile telefon titreşimi. Erişilebilirlik ayarlarında "hareketi azalt" açıksa sarsıntı olmaz; titreşim zaten ortak titreşim ayarına bağlı.
- **"Diğer oyunlar" bağlantısı** ana ekranda (merkez sayfa: furkiozknn.github.io).

### Sayfa
- Paylaşım kartı (Open Graph ve Twitter), simge, `theme-color`, canonical bağlantı ve Türkçe sayfa açıklaması eklendi (açıklama İngilizceydi, sayfa dili Türkçe).
- Özel `404.html` sayfası eklendi.
- Küçük masaüstü ekranlarda (örn. 1366x768) ana ekran paneli iç kaydırma istemiyor; alt bağlantılar görünür kalıyor.

### Geliştirici
- `test/duman.mjs` duman testi eklendi: sayfa açılışı, konsol/404 hatası, oyun başlangıcı, klavye ve dokunmatik girdi, duraklatma, telefonda taşma, eski kayıtla açılış, sayfa meta ögeleri. Bağımlılık depoya eklenmedi; kullanım dosyanın başında.
- `project-meta.json` sürümü 1.1.0 oldu.
