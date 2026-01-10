const ApplicantNameExtractor = require('../applicant-name-extractor');

// Mock Locator helper
const createMockLocator = (innerTextValue, countValue = 1, attributeValue = null) => {
    return {
        first: () => ({
            count: async () => countValue,
            innerText: async () => innerTextValue,
            getAttribute: async () => attributeValue,
        }),
        locator: () => createMockLocator(innerTextValue, countValue, attributeValue),
        count: async () => countValue
    };
};

describe('ApplicantNameExtractor', () => {

    test('should return empty string if no valid name found', async () => {
        const mockLocator = {
            locator: () => ({ first: () => ({ count: async () => 0 }) })
        };
        const result = await ApplicantNameExtractor.extractName(mockLocator);
        expect(result).toBe('');
    });

    test('should extract name from Strategy 1 (Card Title)', async () => {
        const mockLocator = {
            locator: (selector) => {
                if (selector === '.hiring-people-card__title') {
                    return createMockLocator('John Doe');
                }
                return createMockLocator(null, 0);
            }
        };
        const result = await ApplicantNameExtractor.extractName(mockLocator);
        expect(result).toBe('John Doe');
    });

    test('should extract name from Strategy 2 (Lockup Title) and take first line', async () => {
        const mockLocator = {
            locator: (selector) => {
                if (selector === '.hiring-people-card__title') return createMockLocator(null, 0);
                if (selector === '.artdeco-entity-lockup__title') {
                    return createMockLocator('Jane Smith\n2nd degree connection');
                }
                return createMockLocator(null, 0);
            }
        };
        const result = await ApplicantNameExtractor.extractName(mockLocator);
        expect(result).toBe('Jane Smith');
    });

    test('should clean invalid suffixes and status dots', async () => {
        const dirtyName = 'Michael Scott adlı kullanıcının başvurusu • Viewed';
        const mockLocator = {
            locator: (selector) => {
                if (selector === '.hiring-people-card__title') {
                    return createMockLocator(dirtyName);
                }
                return createMockLocator(null, 0);
            }
        };
        const result = await ApplicantNameExtractor.extractName(mockLocator);
        expect(result).toBe('Michael Scott');
    });

    test('should reject invalid names', async () => {
        const invalidNames = ['LinkedIn Member', 'LinkedIn Üyesi', 'Unknown'];

        for (const name of invalidNames) {
            const mockLocator = {
                locator: (selector) => {
                    if (selector === '.hiring-people-card__title') {
                        return createMockLocator(name);
                    }
                    return createMockLocator(null, 0);
                }
            };
            const result = await ApplicantNameExtractor.extractName(mockLocator);
            expect(result).toBe('');
        }
    });
});
