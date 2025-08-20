# HelalRestoran — Statik MVP (Çok Sayfalı)
- Çok sayfalı site: Anasayfa, Restoran Bul (harita), Sertifikalar, Haberler, Hakkımızda, İletişim, Impressum, Datenschutz, Admin.
- Harita: Leaflet + OpenStreetMap (CDN), tarayıcı konum izni ile yarıçap içinde listeleme.
- Admin: localStorage tabanlı CRUD, JSON içe/dışa aktarma, demo verisine sıfırlama.
- Veri: `data/seed.json`. Admin ile değiştirdikleriniz localStorage'a kaydedilir.

## Yayına Alma
### Netlify (önerilir)
1. Bu klasörü zip'ten çıkarın.
2. Netlify → "Add new site" → "Deploy manually" → klasörü sürükleyip bırakın.

### GitHub Pages
1. Repo oluşturun, dosyaları yükleyin.
2. Settings → Pages → Deploy from branch.

## Gelecek Adımlar
- Supabase (Postgres + Auth + Row Level Security) entegrasyonu: gerçek veritabanı ve admin girişi.
- Sertifika kurumlarının resmi API/kaynakları ile doğrulama.
- Yorumlar, fotoğraf yükleme, moderasyon.
- PWA ve offline cache.

---

## Supabase Entegrasyonu (v2)
1) Supabase projesi oluşturun → **Auth (Email/Password)** aktif olsun.
2) **SQL Editor** → `db/schema.sql` içeriğini çalıştırın.
   - `admins` tablosuna kendi emailinizi ekleyin:
     ```sql
     insert into admins(email) values ('you@example.com');
     ```
3) **Project Settings → API** sayfasından
   - `Project URL` ve `anon public` anahtarını alın.
4) Bu repo kökünde `assets/env.sample.js` dosyasını **`assets/env.js`** adında kopyalayın
   ve URL/KEY değerlerini doldurun.
5) Netlify’da dağıtın. `/admin.html` sayfasından **Sign up** (veya Sign in) yapın.
   - Email’iniz `admins` tablosunda olduğu sürece CRUD yetkiniz olur.
6) `/restaurants.html` artık Supabase’teki **RPC `nearby_restaurants`** ile çalışır.

> Not: client tarafındaki `anon key` herkese açıktır; RLS kuralları verinizi korur.
