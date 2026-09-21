# PS5-PRO

PS5 Pro konsol arayüzünü referans alan, bağımsız bir web tabanlı masaüstü kullanıcı arayüzü projesidir. Proje; HTML5, CSS3, Vanilla JavaScript, ES Modules ve JSON veri dosyaları kullanılarak geliştirilmiştir. Herhangi bir frontend framework, CSS framework veya harici UI kütüphanesi kullanılmaz.

> **Yasal Not:** Bu proje Sony Interactive Entertainment ile ilişkili değildir. "PlayStation" ve "PS5 Pro" isimleri ve ilgili markalar ilgili hak sahiplerine aittir. Bu çalışma yalnızca bağımsız bir arayüz/prototip çalışmasıdır. Projede kullanılan görsel, ses ve marka varlıklarının lisans durumu geliştirici tarafından ayrıca kontrol edilmelidir.

---

## İçindekiler

- [Proje Hedefi](#proje-hedefi)
- [Ana Teknolojiler](#ana-teknolojiler)
- [Framework Politikası](#framework-politikası)
- [Proje Mimarisi](#proje-mimarisi)
- [Dosya Sorumlulukları](#dosya-sorumlulukları)
- [Modül Mimarisi](#modül-mimarisi)
- [Veri Akışı](#veri-akışı)
- [State Yönetimi](#state-yönetimi)
- [Routing](#routing)
- [Input Sistemi](#input-sistemi)
- [Fullscreen](#fullscreen)
- [Ses Sistemi](#ses-sistemi)
- [Asset Yönetimi](#asset-yönetimi)
- [Oyun Sistemi](#oyun-sistemi)
- [Harici Oyunlar](#harici-oyunlar)
- [Geliştirme Kuralları](#geliştirme-kuralları)
- [Önerilen Geliştirme Sırası](#önerilen-geliştirme-sırası)
- [Kurulum ve Kullanım](#kurulum-ve-kullanım)
- [Tasarım İlkeleri](#tasarım-ilkeleri)

---

## Proje Hedefi

Bu proje, modern bir masaüstü web tarayıcısında çalışan, PS5 Pro konsol arayüzünü referans alan kapsamlı bir kullanıcı arayüzü deneyimi sunmayı hedefler. Uygulama içerisinde aşağıdaki modüler sistemler bulunur:

- Açılış ekranı (boot screen)
- Başlangıç animasyon katmanı
- Ana ekran (home)
- Oyun kütüphanesi
- Mağaza (store)
- Oyun detay ekranları
- Arama ekranı
- Kontrol merkezi
- Hızlı ayarlar
- Profil menüsü
- Bildirimler
- Sistem ayarları
- Güç menüsü
- Oyun başlatma sistemi
- Dahili oyunlar (WolfClicker, Void None)
- Harici oyun sistemi
- Asset yönetimi
- Kayıt ve veri yönetimi

Tüm bu sistemler birbirinden ayrıştırılmış modüller halinde geliştirilir ve ana uygulama kabuğu (`index.html`) üzerinden birleştirilir.

---

## Ana Teknolojiler

- **HTML5** — Semantik yapı ve uygulama iskeleti
- **CSS3** — Görsel katman (framework kullanılmadan)
- **JavaScript (ES Modules)** — Uygulama mantığı ve modüller arası iletişim
- **JSON** — Oyun, mağaza, ayarlar, profil ve trophy verileri
- **Web APIs** — Fullscreen, Audio, Storage, Gamepad, Pointer, Keyboard
- **Local Storage / Browser Storage API** — Kalıcı kullanıcı verileri

---

## Framework Politikası

Bu projede aşağıdakiler **kullanılmaz**:

- React, Vue, Angular veya başka bir frontend framework
- Bootstrap, Tailwind veya başka bir CSS framework
- Harici UI kütüphaneleri
- Harici runtime dependency'leri

Proje tamamen vanilla HTML/CSS/JavaScript üzerine kuruludur. JavaScript tarafı ES Modules standardını kullanır ve `src/main.js` üzerinden başlatılır.

---

## Proje Mimarisi

```text
PS5-PRO/
│
├── index.html
├── package.json
├── README.md
│
├── src/
│   ├── main.js
│   ├── app.js
│   │
│   ├── core/
│   │   ├── router.js
│   │   ├── state.js
│   │   ├── storage.js
│   │   ├── input.js
│   │   ├── audio.js
│   │   └── fullscreen.js
│   │
│   ├── ui/
│   │   ├── boot-screen.js
│   │   ├── startup-animation.js
│   │   ├── home-screen.js
│   │   ├── control-center.js
│   │   ├── game-library.js
│   │   ├── ps-store.js
│   │   ├── game-details.js
│   │   ├── game-launcher.js
│   │   ├── search-screen.js
│   │   ├── notifications.js
│   │   ├── profile-menu.js
│   │   ├── quick-settings.js
│   │   ├── settings-screen.js
│   │   ├── power-menu.js
│   │   └── dialogs.js
│   │
│   ├── systems/
│   │   ├── game-manager.js
│   │   ├── asset-manager.js
│   │   ├── controller-manager.js
│   │   ├── keyboard-manager.js
│   │   ├── save-manager.js
│   │   ├── theme-manager.js
│   │   ├── sound-manager.js
│   │   └── performance-manager.js
│   │
│   ├── data/
│   │   ├── games.json
│   │   ├── store.json
│   │   ├── settings.json
│   │   ├── profiles.json
│   │   └── trophies.json
│   │
│   ├── games/
│   │   ├── wolfclicker/
│   │   │   ├── index.html
│   │   │   ├── game.js
│   │   │   ├── game.css
│   │   │   └── assets/
│   │   │
│   │   └── void-none/
│   │       ├── index.html
│   │       ├── game.js
│   │       ├── game.css
│   │       └── assets/
│   │
│   └── styles/
│       ├── reset.css
│       ├── variables.css
│       ├── layout.css
│       ├── animations.css
│       ├── typography.css
│       ├── components.css
│       ├── boot-screen.css
│       ├── home-screen.css
│       ├── control-center.css
│       ├── game-library.css
│       ├── ps-store.css
│       ├── game-details.css
│       ├── settings-screen.css
│       ├── profile-menu.css
│       └── dialogs.css
│
├── assets/
│   ├── branding/
│   ├── fonts/
│   ├── icons/
│   ├── backgrounds/
│   ├── wallpapers/
│   ├── covers/
│   ├── banners/
│   ├── avatars/
│   ├── trophies/
│   ├── sounds/
│   ├── animations/
│   └── ui/
│       ├── buttons/
│       ├── panels/
│       ├── cards/
│       ├── navigation/
│       └── overlays/
│
├── public/
│   ├── manifest.json
│   └── favicon.ico
│
└── external-games/
    └── games.json