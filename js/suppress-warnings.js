/**
 * This script suppresses specific browser warnings to keep the console clean
 * Currently handles:
 * - Unload event listener deprecation warnings (from extensions like Grammarly)
 */

(function() {
    // Store the original console methods
    const originalWarn = console.warn;
    const originalError = console.error;
    
    // Known warning patterns to suppress
    const suppressPatterns = [
        /Unload event listeners are deprecated/i,
        /Permissions policy violation.*unload is not allowed/i
    ];
    
    // Override console.warn to filter out specific warnings
    console.warn = function(...args) {
        // Check if this is one of the warnings we want to suppress
        if (args.length > 0 && 
            typeof args[0] === 'string' && 
            suppressPatterns.some(pattern => pattern.test(args[0]))) {
            // Suppress the warning
            return;
        }
        
        // Call the original warn method for all other warnings
        originalWarn.apply(console, args);
    };
    
    // Similar approach for console.error if needed
    console.error = function(...args) {
        // Check for specific error patterns to suppress
        if (args.length > 0 && 
            typeof args[0] === 'string' && 
            suppressPatterns.some(pattern => pattern.test(args[0]))) {
            // Suppress the error
            return;
        }
        
        // Call the original error method for all other errors
        originalError.apply(console, args);
    };
    
    // Log that the suppression is active (only in development)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('Warning suppression active for: Unload event listeners, Permissions policy violations');
    }
})();
