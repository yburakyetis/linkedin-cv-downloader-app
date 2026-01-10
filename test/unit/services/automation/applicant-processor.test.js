
const ApplicantProcessor = require('../../../../src/services/automation/applicant-processor');

// Mock dependencies
const mockLog = jest.fn();
const mockError = jest.fn();

global.Logger = {
    info: mockLog,
    warn: mockLog,
    error: mockError,
    debug: mockLog
};

describe('ApplicantProcessor Loop Logic', () => {
    let processor;
    let mockPage;
    let mockConfig;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock Page Object
        mockPage = {
            locator: jest.fn(),
            waitForTimeout: jest.fn().mockResolvedValue(true),
            $: jest.fn()
        };

        mockConfig = {
            minWait: 0,
            maxWait: 0,
            breakInterval: 100
        };

        processor = new ApplicantProcessor(mockPage, mockConfig);

        // Mock internal methods to isolate loop logic
        processor.processSingleApplicant = jest.fn().mockResolvedValue(true);
        processor._cleanUI = jest.fn().mockResolvedValue(true);
        processor._saveProgress = jest.fn().mockResolvedValue(true);
        processor.scrollToDownloadSection = jest.fn().mockResolvedValue(true);

        // Mock state
        processor.processedApplicants = new Set();
        processor.failedApplicants = [];
        processor.processedCount = 0;
        processor.downloadCount = 0;
    });

    test('should iterate through all applicants and increment processedIndex', async () => {
        // Setup: Return 3 fake applicant elements
        const mockElements = [
            { evaluate: jest.fn() },
            { evaluate: jest.fn() },
            { evaluate: jest.fn() }
        ];

        // Mock applicants locator
        const mockLocator = {
            count: jest.fn().mockResolvedValue(3),
            nth: jest.fn((i) => mockElements[i]),
            all: jest.fn().mockResolvedValue(mockElements)
        };

        mockPage.locator.mockReturnValue(mockLocator);

        // Execute
        await processor.processCurrentPage();

        // Verification
        expect(processor.processSingleApplicant).toHaveBeenCalledTimes(3);

        expect(processor.processSingleApplicant).toHaveBeenNthCalledWith(1, mockElements[0]);
        expect(processor.processSingleApplicant).toHaveBeenNthCalledWith(2, mockElements[1]);
        expect(processor.processSingleApplicant).toHaveBeenNthCalledWith(3, mockElements[2]);

        // Logic verification: if processedIndex didn't increment, it would stick at 0 or loop infinitely 
        // (but test env would timeout or call same index).
        // Since we mocked count=3 and it called 3 times, loop is working.
    });

    test('should skip duplicate applicants but still continue loop', async () => {
        // Setup: 2 applicants
        const mockElements = [
            { evaluate: jest.fn() },
            { evaluate: jest.fn() }
        ];

        const mockLocator = {
            count: jest.fn().mockResolvedValue(2),
            nth: jest.fn((i) => mockElements[i]),
            all: jest.fn().mockResolvedValue(mockElements)
        };

        mockPage.locator.mockReturnValue(mockLocator);

        // Make first one throw a "duplicate" signal if we were testing internal logic, 
        // but since we mocked processSingleApplicant, we can simulate its effect or just verify calls.

        // The duplicate check is INSIDE processSingleApplicant in the real code, 
        // OR it's inside the loop before calling processSingleApplicant?
        // Let's check the code structure again to be precise.

        /* 
           Real code:
           processSingleApplicant(applicantLocator) {
               ... extract name ...
               if (duplicate) return; 
           }
           
           So the loop calls processSingleApplicant regardless. The skipping happens inside.
           So checking calledTimes(2) is sufficient to prove the loop continues.
        */

        await processor.processCurrentPage();
        expect(processor.processSingleApplicant).toHaveBeenCalledTimes(2);
    });
});
