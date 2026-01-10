const locales = require('../../config/locales');

describe('Localization Configuration', () => {
    it('should have standard language keys', () => {
        expect(locales).toHaveProperty('tr');
        expect(locales).toHaveProperty('en');
    });

    it('should have matching keys in both languages', () => {
        const trKeys = Object.keys(locales.tr).sort();
        const enKeys = Object.keys(locales.en).sort();

        // Check for missing keys in EN
        const missingInEn = trKeys.filter(key => !enKeys.includes(key));
        if (missingInEn.length > 0) {
            console.warn('Keys missing in EN:', missingInEn);
        }

        // Check for missing keys in TR
        const missingInTr = enKeys.filter(key => !trKeys.includes(key));
        if (missingInTr.length > 0) {
            console.warn('Keys missing in TR:', missingInTr);
        }

        expect(enKeys).toEqual(trKeys);
    });

    it('should not have empty values', () => {
        ['tr', 'en'].forEach(lang => {
            Object.entries(locales[lang]).forEach(([key, value]) => {
                expect(value).toBeTruthy(); // Not null, undefined, or empty string
            });
        });
    });
});
