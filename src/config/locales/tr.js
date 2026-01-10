(function (global) {
    var tr = {
        // Header
        'app.title': 'LinkedIn CV İndirici',
        'app.subtitle': 'İK profesyonelleri için otomatik CV indirme aracı',

        // Form Labels
        'label.applicantsUrl': 'ADAY SAYFASI LİNKİ (URL)',
        'label.maxCvCount': 'MAKSİMUM CV',
        'label.startPage': 'BAŞLANGIÇ SAYFASI',
        'label.minWait': 'MİN BEKLEME (SN)',
        'label.maxWait': 'MAX BEKLEME (SN)',
        'label.pageWaitMin': 'SAYFA GEÇİŞ MİN (SN)',
        'label.pageWaitMax': 'SAYFA GEÇİŞ MAX (SN)',
        'label.stealthSettings': 'Gizlilik Ayarları',
        'label.breakInterval': 'MOLA ARALIĞI (CV)',
        'label.breakDurationMin': 'MOLA MİN (SN)',
        'label.breakDurationMax': 'MOLA MAX (SN)',
        'hint.breakInterval': 'Her N indirmede bir, Min-Max süreleri arasında rastgele mola verilir',
        'hint.applicantWait': 'Her CV indirilişi sonrasında, Min-Max süreleri arasında rastgele beklenir',
        'hint.pageWait': 'Her sayfa geçişi sonrasında, Min-Max süreleri arasında rastgele beklenir',

        // Buttons
        'btn.start': 'Başlat',
        'btn.pause': 'Duraklat',
        'btn.continue': 'Devam Et',
        'btn.stop': 'Durdur',
        'btn.close': 'Kapat',
        'btn.reset': 'Çıkış / Sıfırla',
        'btn.resumeSession': 'Oturumu Devam Ettir',
        'btn.discardSession': 'Sil ve Yeni Başla',

        // Dashboard
        'stat.processed': 'İşlenen',
        'stat.success': 'Başarılı',
        'stat.failed': 'Başarısız / Atlanan',
        'header.failedList': 'BAŞARISIZ İŞLEMLER',
        'report.title': 'İşlem Raporu',
        'label.saveLocation': 'KAYIT YERİ',

        // Messages
        // Tooltips
        'tooltip.start': 'Mevcut ayarlarla indirme işlemini başlatır',
        'tooltip.pause': 'İşlemi geçici olarak duraklatır',
        'tooltip.stop': 'İndirme işlemini tamamen durdurur',
        'tooltip.reset': 'Çıkış yapar ve tüm oturum verilerini temizler',

        'msg.loginRequired': 'Giriş gerekli. Lütfen tarayıcı penceresinden LinkedIn\'e giriş yapın.',
        'msg.waitingAuth': 'Manuel giriş bekleniyor (Max 5 dk)...',
        'msg.sessionSaved': 'Oturum kaydedildi.',
        'msg.usingSession': 'Mevcut oturum kullanılıyor.',
        'msg.resuming': 'Önceki oturum devam ettiriliyor...',
        'msg.starting': 'İndirme işlemi başlatılıyor...',
        'msg.stopping': 'Durduruluyor... Lütfen bekleyin.',
        'msg.paused': 'İşlem duraklatıldı. Devam etmek için tıklayın.',
        'msg.completed': 'İndirme tamamlandı!',
        'msg.error': 'Hata:',
        'msg.noFailures': '✨ Hata yok! Tüm işlemler başarılı.',

        // Prompts
        'prompt.stop': 'İndirme işlemini durdurmak istediğinize emin misiniz?',
        'prompt.reset': 'Çıkış yapmak ve tüm oturum verilerini silmek istediğinize emin misiniz? Bir dahaki sefere tekrar giriş yapmanız gerekecek.',
        'prompt.resume': 'Önceki oturum bulundu. Kaldığınız yerden devam etmek ister misiniz?\n\n[Tamam] = Devam Et (Resume)\n[İptal] = Sıfırdan Başla (New Session)',

        // Placeholders
        'placeholder.url': 'https://www.linkedin.com/hiring/jobs/.../applicants/...',
        // Banner & Footer
        'banner.sessionActive': 'Aktif Oturum Bulundu',
        'banner.sessionInfo': 'Önceki oturum ayarları yüklendi. Başlat diyerek devam edebilirsiniz.',
        'footer.note': 'Not: İlk kullanımda manuel giriş yapın. Oturum otomatik kaydedilir.',
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = tr;
    }
    if (global) {
        global.locales_tr = tr;
    }
})(typeof window !== 'undefined' ? window : this);
