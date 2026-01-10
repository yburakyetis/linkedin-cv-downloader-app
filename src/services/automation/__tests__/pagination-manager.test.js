const PaginationManager = require('../pagination-manager');
const { SELECTORS } = require('../../../config/constants');

// Mock dependencies
const mockPage = {
    locator: jest.fn(),
    evaluate: jest.fn(),
    waitForFunction: jest.fn(),
    waitForTimeout: jest.fn()
};
const mockInteractionUtils = require('../interaction-utils'); // We will mock this module

// Mock the InteractionUtils module
jest.mock('../interaction-utils', () => ({
    smoothScrollTo: jest.fn(),
    microPause: jest.fn(),
    slowMouseMove: jest.fn(),
    randomWait: jest.fn()
}));

// Helper to create mock locators
const createMockLocator = (matches = [], isVisible = true) => ({
    count: jest.fn().mockResolvedValue(matches.length),
    nth: jest.fn((n) => matches[n] || createMockLocator()),
    first: jest.fn(() => matches[0] || createMockLocator()),
    locator: jest.fn(() => createMockLocator()), // Chainable
    innerText: jest.fn().mockResolvedValue('1'),
    click: jest.fn().mockResolvedValue(undefined),
    isVisible: jest.fn().mockResolvedValue(isVisible)
});

describe('PaginationManager', () => {
    let manager;
    const progressCallback = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        manager = new PaginationManager(mockPage, {}, progressCallback);
    });

    describe('getActivePageNumber', () => {
        it('should return parsed integer from active button', async () => {
            mockPage.locator.mockReturnValue({
                count: jest.fn().mockResolvedValue(1),
                innerText: jest.fn().mockResolvedValue('5')
            });

            const pageNum = await manager.getActivePageNumber();
            expect(pageNum).toBe(5);
            expect(mockPage.locator).toHaveBeenCalledWith(SELECTORS.ACTIVE_PAGE_BUTTON);
        });

        it('should default to 1 if no button found', async () => {
            mockPage.locator.mockReturnValue({
                count: jest.fn().mockResolvedValue(0)
            });

            const pageNum = await manager.getActivePageNumber();
            expect(pageNum).toBe(1);
        });

        it('should default to 1 on error', async () => {
            mockPage.locator.mockReturnValue({
                count: jest.fn().mockRejectedValue(new Error('DOM Error'))
            });

            const pageNum = await manager.getActivePageNumber();
            expect(pageNum).toBe(1);
        });
    });

    describe('isNextPageAvailable', () => {
        // Setup extensive mocks for this logic if needed, 
        // but for unit test brevity we focus on the logic flow.
        // This method is DOM-heavy making it harder to test without a full JSDOM setup or complex mocks.
        // We'll skip deep testing here for now and focus on switchToNextPage logic which is critical.
    });

    describe('switchToNextPage', () => {
        it('should click the "Next" button if found', async () => {
            // Mock config
            manager.config = { pageWaitMin: 1, pageWaitMax: 2 };

            // Mock Locators
            const mockNextBtn = {
                count: jest.fn().mockResolvedValue(1),
                isVisible: jest.fn().mockResolvedValue(true),
                first: jest.fn().mockReturnThis(),
                click: jest.fn().mockResolvedValue(undefined)
            };

            // When locator searches for Next button labels
            mockPage.locator.mockImplementation((selector) => {
                if (selector.includes('aria-label="Next"')) {
                    return mockNextBtn;
                }
                return { count: jest.fn().mockResolvedValue(0) }; // Other selectors empty
            });

            // Mock InteractionUtils.randomWait
            require('../interaction-utils').randomWait.mockResolvedValue();

            // Mock successful page wait
            mockPage.waitForFunction.mockResolvedValue(true);

            const result = await manager.switchToNextPage();

            expect(result).toBe(true);
            expect(mockNextBtn.click).toHaveBeenCalled();
            expect(progressCallback).toHaveBeenCalledWith(expect.objectContaining({ type: 'info' }));
        });

        it('should return false if no next button or list item found', async () => {
            // Mock empty everything
            mockPage.locator.mockReturnValue({
                count: jest.fn().mockResolvedValue(0),
                isVisible: jest.fn().mockResolvedValue(false)
            });

            const result = await manager.switchToNextPage();

            expect(result).toBe(false);
            expect(progressCallback).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Could not find') }));
        });
    });
});
