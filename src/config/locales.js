/**
 * Localization Strings
 * Languages: TR (Default), EN
 */

let tr, en;

if (typeof window !== 'undefined') {
    // Browser Context: Expecting script tags to have loaded these
    console.log('Loader: locales.js executing', { tr: !!window.locales_tr, en: !!window.locales_en });
    tr = window.locales_tr || {};
    en = window.locales_en || {};
} else {
    // Node Context
    try {
        tr = require('./locales/tr');
        en = require('./locales/en');
    } catch (e) {
        console.error('Failed to load locales via require', e);
        tr = {}; en = {};
    }
}

const locales = {
    tr,
    en
};

// Export for renderer usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = locales;
}
if (typeof window !== 'undefined') {
    window.locales = locales;
}
