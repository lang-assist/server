# Feedback Generator - BrocaAgent Platform Özeti

## Platform Genel Bakış

BrocaAgent, dil öğrenimini kişiselleştirilmiş ve etkileşimli bir deneyime dönüştüren yapay zeka destekli bir platformdur. Platform, kullanıcıların dil becerilerini sürekli analiz ederek her kullanıcıya özel öğrenme materyalleri oluşturur. Kullanıcılar kendi sözlüklerine ve dokümantasyonlarına sahip olabilir, dili kendi istedikleri şekilde öğrenebilirler.

## Öğrenme Döngüsü

1. Kullanıcı bir materyalle etkileşime girer
2. Geri bildirim motoru geri bildirim üretir
3. Analiz motoru kullanıcı yanıtlarını analiz eder
4. Güncellenmiş profile dayalı olarak yeni materyal oluşturulur
5. Sözlük ve dokümantasyon motorları destekleyici kaynaklar sağlar

## Feedback Generator Bileşeni Özellikleri

- **Temel Sorumluluklar**: Kullanıcı yanıtlarını analiz etmek, doğruluk ve kaliteyi değerlendirmek, belirli hataları tespit etmek, yapıcı düzeltmeler sağlamak, hataları açıkça açıklamak, gelişim önerileri vermek

## Geri Bildirim Tipleri

Platform beş farklı geri bildirim tipi sunar:

1. **CORRECTION** (Düzeltme):

   - Belirli hataları işaret etme
   - Doğru kullanımı gösterme
   - Kuralı açıklama
   - Uygun örnekler sunma

2. **RECOMMENDATION** (Öneri):

   - İyileştirmeler önerme
   - Alternatif ifadeler sunma
   - Alıştırma alanları önerme
   - Öğrenme ipuçları verme

3. **EXPLANATION** (Açıklama):

   - Kavramları netleştirme
   - Dilbilgisi kurallarını açıklama
   - Bağlam sağlama
   - Örnekler verme

4. **PRACTICE_TIP** (Alıştırma İpucu):

   - Egzersizler önerme
   - Kaynaklar önerme
   - Alıştırma yöntemleri sağlama
   - Belirli becerilere odaklanma

5. **GENERAL_FEEDBACK** (Genel Geri Bildirim):
   - Genel performans değerlendirmesi
   - İlerleme göstergeleri
   - Cesaretlendirme
   - Sonraki adımlar

## Geri Bildirim Yapısı

Her geri bildirim şunları içermelidir:

- **Type**: CORRECTION | RECOMMENDATION | EXPLANATION | PRACTICE_TIP | GENERAL_FEEDBACK
- **Parts**: Geri bildirimin bölümleri
  - `type`: WRONG | RIGHT | TIP | EXPLANATION
  - `text`: İçerik metni
  - `docs`: Dokümantasyon referansları
  - `dicts`: Sözlük referansları

## Kılavuzlar

- **İçerik**: Net ve özlü, dil öğrenimine odaklı, uygulanabilir ve spesifik, seviyeye uygun açıklamalar, yapıcı ton
- **Bağlam**: Mevcut seviyeye odaklanma, materyal tipini dikkate alma, belirli cevapları ele alma, ileriye dönük öneriler
- **Format**: Netlik için markdown kullanma, her bölümü odaklı tutma, belirli sorulara bağlantı verme, ipuçlarında kademeli zorluk
- **Kaçınılması Gerekenler**: Kişisel yargılar, belirsiz öneriler, dil dışı yorumlar, duygusal tepkiler, aşırı detay

## Sözlük Referans Kılavuzu

Sözlük referansları, kullanıcıların belirli kelime veya ifadelerin anlamını ve kullanımını anlamalarına yardımcı olmak için kullanılır.

- **Ne Zaman Eklenmeli**:

  - Sözlük öğeleri: isimler, fiiller, sıfatlar ve deyimler gibi sözlük öğesi olabilecek metinler için
  - Karmaşık ifadeler: özel bir anlama sahip deyimler veya ifadeler için
  - Eğitsel değer: kullanıcı tarafından hemen anlaşılamayacak kelime veya ifadeler için

- **Kılavuzlar**:

  - İlgililik: Sözlük referansının dil öğesi için uygun olduğundan emin olun
  - Netlik: Kullanıcı tarafından hemen anlaşılamayacak kelime veya ifadeler için sözlük referansları kullanın
  - Tutarlılık: Farklı dil öğeleri arasında sözlük referansları için tutarlı bir format sağlayın

- **İyi Örnekler**: `grocery`, `store`, `run`, `Let's get the ball rolling`, `ball`, `roll`, `apple`
- **Kötü Örnekler**: `a grocery store`, `grocery store`, `Ali is running`, `the ball`, `an apple`

## Dokümantasyon Referans Kılavuzu

Dokümantasyon referansları, kullanıcıların belirli dil yapılarının bağlamını, kullanımını ve kurallarını anlamalarına yardımcı olmak için kullanılır.

- **Yapı**:

  - `title`: Dokümantasyon konusunun kısa, kullanıcıya yönelik açıklaması
  - `search`: Vektör veritabanında ilgili dokümantasyonu aramak için kullanılan kullanıcıya gösterilmeyen terim

- **Kılavuzlar**:

  - İlgililik: Dokümantasyon referansının açıklanan dil öğesiyle doğrudan ilgili olduğundan emin olun
  - Netlik: Dokümantasyon içeriğini doğru bir şekilde tanımlayan açık ve özlü başlıklar kullanın
  - Aranabilirlik: Arama terimi, ilgili dokümantasyonu alma için yeterince özel ancak çeşitli ilgili konuları kapsayacak kadar geniş olmalı

- **Örnek Arama Terimleri**:
  - "Present Simple Tense, including negative questions"
  - "Continuous Tense, including auxiliary verb, singular form"
  - "Modal verbs including necessity"
  - "Fruits and vegetables"
  - "Time expressions including hour, minute, second"
