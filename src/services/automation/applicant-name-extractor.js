/**
 * Applicant Name Extractor
 * Responsible for identifying and cleaning applicant names from DOM elements.
 * Extracted from ApplicantProcessor to follow SRP.
 */

const Logger = require('../../utils/logger');

class ApplicantNameExtractor {

    constructor() {
        this.invalidNames = ['LinkedIn Üyesi', 'LinkedIn Member', 'Unknown', 'Gizli'];
    }

    /**
     * Main method to extract name using multiple strategies
     * @param {Locator} applicantLocator - Playwright locator for the applicant card
     * @returns {Promise<string>} - The extracted and cleaned name, or empty string
     */
    async extractName(applicantLocator) {
        try {
            // Strategy 1 (Best): Specific card title from xd.html analysis
            const cardTitle = applicantLocator.locator('.hiring-people-card__title').first();
            if (await cardTitle.count() > 0) {
                const text = await cardTitle.innerText();
                if (this._isValidName(text)) return this._cleanName(text);
            }

            // Strategy 2: Generic Entity Lockup Title
            const lockupTitle = applicantLocator.locator('.artdeco-entity-lockup__title').first();
            if (await lockupTitle.count() > 0) {
                const text = await lockupTitle.innerText();
                const firstLine = text.split('\n')[0];
                if (this._isValidName(firstLine)) return this._cleanName(firstLine);
            }

            // Strategy 3: Link inside title (Legacy support)
            const link = applicantLocator.locator('.artdeco-entity-lockup__title a').first();
            if (await link.count() > 0) {
                const text = await link.innerText();
                if (this._isValidName(text)) return this._cleanName(text);
            }

            // Strategy 4: Image Alt/Aria
            const img = applicantLocator.locator('img.presence-entity__image').first();
            if (await img.count() > 0) {
                // Alt often has "Name Surname fotoğrafı"
                const alt = await img.getAttribute('alt');
                if (alt) {
                    const cleanAlt = alt.replace(/\s+fotoğrafı$/i, '').trim();
                    if (this._isValidName(cleanAlt)) return cleanAlt;
                }
            }

        } catch (e) {
            Logger.warn('Error extracting applicant name', e);
        }
        return '';
    }

    _isValidName(text) {
        if (!text) return false;
        const clean = text.trim();
        if (clean.length < 2) return false;
        if (this.invalidNames.some(invalid => clean.includes(invalid))) return false;
        return true;
    }

    _cleanName(text) {
        return text.replace(/\n/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/\b(adlı kullanıcının başvurusu|application)\b/gi, '') // Remove suffixes
            .replace(/\b(\d+(st|nd|rd|th)|1. 2. 3.)\s+degree connection\b/gi, '') // Remove connection info
            .replace(/•.*$/, '') // Remove status dots
            .trim();
    }
}

module.exports = new ApplicantNameExtractor();
