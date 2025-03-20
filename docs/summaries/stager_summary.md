# Stage Generator - BrocaAgent Platform Özeti

## Platform Genel Bakış

BrocaAgent, dil öğrenimini kişiselleştirilmiş ve etkileşimli bir deneyime dönüştüren yapay zeka destekli bir platformdur. Platform, kullanıcıların dil becerilerini sürekli analiz ederek her kullanıcıya özel öğrenme materyalleri oluşturur. Kullanıcılar kendi sözlüklerine ve dokümantasyonlarına sahip olabilir, dili kendi istedikleri şekilde öğrenebilirler.

## Öğrenme Döngüsü

1. Kullanıcı bir materyalle etkileşime girer
2. Geri bildirim motoru geri bildirim üretir
3. Analiz motoru kullanıcı yanıtlarını analiz eder
4. Güncellenmiş profile dayalı olarak yeni materyal oluşturulur
5. Sözlük ve dokümantasyon motorları destekleyici kaynaklar sağlar

## Stager Bileşeni Özellikleri

- **Görevi**: Kullanıcının dil öğrenme yolculuğunda ilerlemesine yardımcı olacak kapsamlı öğrenme aşamaları oluşturmak
- **Girdi Bilgiler**: Hedef dil, mevcut dil yeterliliği seviyeleri, öğrenme hedefleri, öğrenme tercihleri, önceki aşamaların özetleri
- **Çıktı**: Belirli bir yapıya sahip JSON nesnesi

## Aşama Yapısı (JSON)

1. `name`: Aşama adı (kısa, açıklayıcı, 2-3 kelime)
2. `description`: Aşama açıklaması (1-2 cümle)
3. `imagePrompt`: Aşamayı temsil eden görsel için açıklayıcı istem
4. `resources`: Öğrenme kaynakları
   - `docs`: Dokümantasyon kaynakları
   - `sentences`: Dilbilimsel birim çözücüsüne gönderilecek örnek cümleler
5. `tasks`: Aşama görevleri (materyal tipleri: QUIZ, CONVERSATION, STORY)
6. `focusSkills`: Bu aşamada odaklanılacak beceriler
7. `focusAreas`: Bu aşamada odaklanılacak alanlar
8. `includedTopics`: Bu aşamada ele alınacak konular

## Materyal Tipleri

- **QUIZ**: Farklı soru tiplerini (çoktan seçmeli, doğru/yanlış, boşluk doldurma, eşleştirme, sıralama, yazma, kaydetme) içerebilen bilgi testleri
- **CONVERSATION**: Öğrenci ve yapay zeka arasında belirli bir senaryoda gerçekleşen sohbet
- **STORY**: Cümleler ve sorular koleksiyonu

## Zorluk Yönetimi

- Her dil becerisi 0-100 ölçeğinde değerlendirilir
- Seviyeler detaylı göstergelerle tanımlanır (0-10'dan 91-100'e kadar)
- Gerçekçi ilerleme hedefleri (genellikle aşama başına %5-10 artış)
- Odak becerilerinde daha büyük artışlar hedeflenir

## Resim İstemi Kuralları

- İstemler İngilizce, özgün ve açıklayıcı olmalı (10-50 kelime arası)
- Metin öğeleri, saatler, sayılar, tarihler, işaretler ve etiketler dahil edilmemeli
- Görsel öğelere odaklanılmalı, soyut kavramlardan kaçınılmalı
- İyi yapılandırılmış (ana konu, ortam/arka plan, eylemler/duruşlar, detaylar)
