const ApplicantProcessor = require('../applicant-processor');
const { SELECTORS } = require('../../../config/constants');

// Mock specific parts of the processor and page
jest.mock('../../../utils/logger', () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

jest.mock('../interaction-utils', () => ({
    microPause: jest.fn().mockResolvedValue(true),
    slowMouseMove: jest.fn().mockResolvedValue(true),
    randomWait: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../state-manager', () => ({
    saveState: jest.fn(),
    loadState: jest.fn(),
}));

jest.mock('../applicant-name-extractor', () => ({
    extractName: jest.fn().mockResolvedValue('John Doe'),
}));

describe('ApplicantProcessor - Safe Click Strategy', () => {
    let mockPage;
    let mockConfig;
    let mockProgressCallback;
    let processor;

    beforeEach(() => {
        mockPage = {
            locator: jest.fn(),
            waitForTimeout: jest.fn().mockResolvedValue(true),
            evaluate: jest.fn(),
            $: jest.fn(),
        };
        mockConfig = { maxCvCount: 10 };
        mockProgressCallback = jest.fn();

        processor = new ApplicantProcessor(mockPage, mockConfig, mockProgressCallback, '/tmp/downloads');
        processor.waitForDetailsPanel = jest.fn().mockResolvedValue(true);
        processor._checkForPause = jest.fn().mockResolvedValue(true);
    });

    test('should prioritize CLICK on safe targets (subtitle/caption/metadata)', async () => {
        // Mock Locator Chain
        const elementMock = {
            count: jest.fn().mockResolvedValue(1), // Found safe target!
            click: jest.fn().mockResolvedValue(true),
            evaluate: jest.fn(),
            scrollIntoViewIfNeeded: jest.fn(),
        };

        const safeTargetMock = {
            first: jest.fn().mockReturnValue(elementMock)
        };

        const originalLocatorMock = {
            locator: jest.fn().mockReturnValue(safeTargetMock),
            evaluate: jest.fn(),
            click: jest.fn() // Should NOT be called directly if safe target is found
        };

        // Execution
        await processor._selectAndVerifyApplicant(originalLocatorMock, 'John Doe');

        // Verification
        // 1. Should have asked for safe target using selector
        expect(originalLocatorMock.locator).toHaveBeenCalledWith(SELECTORS.APPLICANT_CLICK_TARGET);

        // 2. Should have clicked the SAFE target
        expect(elementMock.click).toHaveBeenCalled();

        // 3. Should NOT have clicked the original container directly
        expect(originalLocatorMock.click).not.toHaveBeenCalled();
    });

    test('should fallback to container click if no safe target found', async () => {
        // Mock Locator Chain
        const safeTargetMock = {
            first: () => ({
                count: jest.fn().mockResolvedValue(0), // No safe target found
            })
        };

        const originalLocatorMock = {
            locator: jest.fn().mockReturnValue(safeTargetMock),
            evaluate: jest.fn(),
            click: jest.fn().mockResolvedValue(true), // Should be called
            scrollIntoViewIfNeeded: jest.fn()
        };

        // Execution
        await processor._selectAndVerifyApplicant(originalLocatorMock, 'Jane Doe');

        // Verification
        expect(originalLocatorMock.locator).toHaveBeenCalledWith(SELECTORS.APPLICANT_CLICK_TARGET);

        // Since safe target count was 0, it should use original locator
        expect(originalLocatorMock.click).toHaveBeenCalled();
    });
});
