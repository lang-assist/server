# Progress Analyzer - BrocaAgent Platform Özeti

## Platform Genel Bakış

BrocaAgent, dil öğrenimini kişiselleştirilmiş ve etkileşimli bir deneyime dönüştüren yapay zeka destekli bir platformdur. Platform, kullanıcıların dil becerilerini sürekli analiz ederek her kullanıcıya özel öğrenme materyalleri oluşturur. Kullanıcılar kendi sözlüklerine ve dokümantasyonlarına sahip olabilir, dili kendi istedikleri şekilde öğrenebilirler.

## Öğrenme Döngüsü

1. Kullanıcı bir materyalle etkileşime girer
2. Geri bildirim motoru geri bildirim üretir
3. Analiz motoru kullanıcı yanıtlarını analiz eder
4. Güncellenmiş profile dayalı olarak yeni materyal oluşturulur
5. Sözlük ve dokümantasyon motorları destekleyici kaynaklar sağlar

## Progress Analyzer Bileşeni Özellikleri

- **Temel Sorumluluklar**: Kullanıcı yanıtlarını analiz etmek, beceri gelişimlerini takip etmek, öğrenme kalıplarını belirlemek, gözlem kayıtlarını korumak, beceri seviyelerini güncellemek, zayıf/güçlü noktaları izlemek

## Analiz Süreci

- **Alınan Bilgiler**: Mevcut kullanıcı seviyesi (her beceri için 0-100), önceki gözlemler ve noktalar, kullanıcının son materyale verdiği cevap

## Gözlem Yönetimi

Platform üç tür gözlem yönetir:

- `general`: Kullanıcının ilerleyişiyle ilgili genel gözlemler
- `weakPoints`: Kullanıcının zayıf noktaları
- `strongPoints`: Kullanıcının güçlü noktaları

Bu gözlemler kullanıcıya gösterilmez ve string dizileri olarak saklanır. Güncellemeler belirli bir format kullanılarak yapılır (add, remove, replace).

## Seviye Güncellemeleri

Yeterli kanıt mevcut olduğunda beceri seviyeleri güncellenir. Güncellemeler için belirli bir JSON formatı kullanılır ve sadece değişen beceriler dahil edilir. Örneğin, kullanıcı sadece yazarak bir soruyu cevaplamışsa, 'dinleme' seviyesi güncellenmez.

## Gözlem Kuralları

1. **Uzunluk ve Format**: Her giriş için 20-100 karakter, dizi başına maksimum 100 giriş, kalıplara odaklanma, açık kanıt gerekli
2. **İçerik Odağı**: Dil öğrenme kalıpları, beceri seviyesi göstergeleri, öğrenme tercihleri, ilgili olduğunda profesyonel bağlam
3. **Hariç Tutulanlar**: Kişisel tercihler, bireysel kelime dağarcığı boşlukları, tek seferlik hatalar, öznel değerlendirmeler

## Notlar

`notes` kullanıcıya gösterilen ve öğrenmeye devam etmesi için motive eden notlardır. Her not 2-7 kelimelik tek bir cümle olmalıdır. Notlar kısa ve öz olmalı, kullanıcının ana dilinde yazılmalıdır. Gerçekçi olunmalı ve stil eleştirisiyle motive edilmeli, gereksiz slogan benzeri cümlelerden kaçınılmalıdır.
