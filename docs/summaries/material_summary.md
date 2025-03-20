# Material Generators - BrocaAgent Platform Özeti

## Platform Genel Bakış

BrocaAgent, dil öğrenimini kişiselleştirilmiş ve etkileşimli bir deneyime dönüştüren yapay zeka destekli bir platformdur. Platform, kullanıcıların dil becerilerini sürekli analiz ederek her kullanıcıya özel öğrenme materyalleri oluşturur. Kullanıcılar kendi sözlüklerine ve dokümantasyonlarına sahip olabilir, dili kendi istedikleri şekilde öğrenebilirler.

## Öğrenme Döngüsü

1. Kullanıcı bir materyalle etkileşime girer
2. Geri bildirim motoru geri bildirim üretir
3. Analiz motoru kullanıcı yanıtlarını analiz eder
4. Güncellenmiş profile dayalı olarak yeni materyal oluşturulur
5. Sözlük ve dokümantasyon motorları destekleyici kaynaklar sağlar

## Materyal Tipleri

Platform, kullanıcıların dil öğrenme deneyimini zenginleştirmek için üç temel materyal tipi sunar:

### 1. QUIZ

- **Tanım**: Belirli dil becerilerini test eden ve pekiştiren etkileşimli değerlendirmeler
- **Yapı**:
  - `preludes`: İsteğe bağlı ön bilgiler, sorular için bağlam oluşturur
  - `questions`: Farklı soru tiplerinden oluşan dizi
- **Soru Tipleri**:
  - TEXT_INPUT_WRITE: Kullanıcının serbestçe cevap yazabildiği
  - FILL_BLANK: Boşluk doldurma (yazarak veya seçerek)
  - CHOICE: Tek doğru cevaplı seçme soruları
  - MULTIPLE_CHOICE: Birden fazla doğru cevaplı seçme soruları
  - MATCHING: Eşleştirme soruları
  - ORDERING: Sıralama soruları
  - TRUE_FALSE: Doğru/yanlış soruları
  - RECORD: Sesli yanıt gerektiren sorular
- **Krititik Kurallar**:
  - Prelude (ön bilgi) ve soru metinlerinde aynı kelimeler kullanılmamalı
  - Görsellerle doğrudan cevap verilmemeli
  - Sorular gerçek dil anlayışı gerektirmeli, sadece eşleştirme yoluyla cevaplanamamalı

### 2. STORY

- **Tanım**: Okuma anlama ve etkileşimli sınavları birleştiren anlatılar
- **Yapı**:
  - `parts`: Her bir parça metni, görseli veya soruyu içeren diziler
  - Her parça benzersiz bir ID ile tanımlanır
- **Parça Tipleri**:
  - AUDIO: Sesli anlatım veya karakter diyaloğu (SSML formatında)
  - PICTURE: Görsel sahne tasviri
  - QUESTION: Hikaye hakkında etkileşimli sorular
- **Hikaye Kuralları**:
  - Hikaye küçük, tek cümlelik ses parçalarıyla ilerler
  - Her anlatı parçası ayrı ayrı sunulur ve seslendirilir
  - Hikaye sorularda duraklar, cevaptan sonra devam eder
  - Minimum 15-20 cümle içermeli
  - Minimum 5 soru (ortalama 7-8) içermeli
  - Tamamlanma süresi en az 4-5 dakika olmalı
- **Ses Kılavuzları**:
  - Karakter diyalogları için sadece karakter sesleri kullanılmalı
  - Her karakter tutarlı bir sese sahip olmalı
  - Anlatıcı kullanımı çok sınırlı olmalı

### 3. CONVERSATION

- **Tanım**: Gerçek dünya iletişim becerilerini geliştiren simüle edilmiş diyalog senaryoları
- **Yapı**:
  - `scenarioScaffold`: Konuşma senaryosunun iskeleti
  - `characters`: Senaryodaki tüm karakterlerin bilgileri
  - `instructions`: Kullanıcının senaryo doğrultusunda konuşmasına yönelik talimatlar
  - `length`: Konuşmanın yaklaşık kaç tur süreceğini belirtir (5-50 tur arası)
- **Karakter Yapısı**:
  - `name`: Karakter adı (kültüre uygun, `$user` kullanıcı için ayrılmış)
  - `description`: Karakterin rolü ve kişiliği
  - `avatarPrompt`: Avatar oluşturma istemi
  - `gender`: Karakterin cinsiyeti (Male, Female, Neutral)
  - `locale`: Karakterin dili (en-US, tr-TR, vb.)
- **Senaryo Önerileri**:
  - Günlük durumlar için senaryolar oluşturulmalı
  - Kültürel farkındalık gösterilmeli
  - Senaryolar küçük ve pratik olmalı

## Ortak Özellikler ve Kılavuzlar

### Görsel İçerik Kuralları (Picture Prompts)

- İstemler İngilizce, özgün ve açıklayıcı olmalı (10-50 kelime arası)
- Metin öğeleri, saatler, sayılar, tarihler, işaretler ve etiketler DAHİL EDİLMEMELİ
- Görsel öğelere odaklanılmalı, soyut kavramlardan kaçınılmalı
- Ana konu, ortam/arka plan, eylemler/duruşlar, detaylar belirtilmeli

### SSML Dokümantasyonu (Ses İçeriği)

- Microsoft Azure TTS servisi kullanılır
- SSML içeriği `<voice name="ses-adı">İçerik</voice>` formatında olmalı
- Desteklenen etiketler:
  - `<break/>`: Duraklamalar için
  - `<mstts:silence>`: Sessizlik eklemek için
  - `<p>` ve `<s>`: Paragraf ve cümle ayırıcıları için
  - `<mstts:express-as>`: Ses stillerini belirtmek için

### Zorluk Yönetimi

- Her dil becerisi 0-100 ölçeğinde değerlendirilir
- Materyaller kullanıcının mevcut seviyesinin biraz üzerinde olmalı (~%5-10)
- Materyal içinde kademeli zorluk artışı sağlanmalı
- Açık öğrenme hedefleri belirlenmiş olmalı
- Uygun zorlukta içerikler sunulmalı

### İpucu Yönetimi

- Kullanıcının seviyesi, geliştirilecek beceriler ve materyal zorluk seviyesi dikkate alınmalı
- Kullanıcının materyal içinde göreceği içerikler dikkatli planlanmalı
- Sorular dil anlayışı gerektirmeli, basit eşleştirme ile cevaplanamaz olmalı
- Görsel içerikler gereksiz ipuçları içermemeli

### Cevap Maddeleri Yapısı

- Her cevap maddesi benzersiz bir ID içermeli
- Kullanıcı seviyesine uygun, net ve özlü metin içermeli
- Görsel kullanımı öğrenmeyi geliştirdiğinde eklenmeli
