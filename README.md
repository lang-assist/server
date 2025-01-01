# Lang Assist Server

Lang Assist platformunun backend sunucusu.

## Teknolojiler

- Node.js
- Express
- Apollo Server
- GraphQL
- MongoDB
- Redis
- PostgreSQL

## Gereksinimler

- Node.js (v18 veya üzeri)
- MongoDB
- Redis
- PostgreSQL

## Kurulum

1. Repository'yi klonlayın:

```bash
git clone https://github.com/lang-assist/server.git
```

2. Bağımlılıkları yükleyin:

```bash
npm install
```

3. Çevre değişkenlerini ayarlayın:

```bash
cp .env.example .env
```

4. Veritabanlarını kurun:

- MongoDB'yi başlatın
- Redis'i başlatın
- PostgreSQL'i başlatın ve veritabanını oluşturun

## Geliştirme

```bash
npm run dev
```

## Test

```bash
npm test
```

## Production Build

```bash
npm run build
npm start
```

## API Dokümantasyonu

GraphQL playground'a `http://localhost:4000/graphql` adresinden erişebilirsiniz.

## Lisans

Bu proje MIT lisansı altında lisanslanmıştır.
