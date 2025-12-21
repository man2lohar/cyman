    // Disable right-click context menu
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });

    // Disable specific key combinations
    document.addEventListener('keydown', function(e) {
        // Check if any restricted combination is pressed
        if (
            e.key === 'F12' ||                                       // F12
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) || // Ctrl+Shift+I or Ctrl+Shift+J
            (e.ctrlKey && e.key === 'U') ||                          // Ctrl+U
            (e.ctrlKey && e.keyCode === 85)                          // Ctrl+U alternative using keyCode
        ) {
            e.preventDefault();
            return false; // Block the default action without alerting
        }
    });

    // Optional: Detect if Developer Tools are open in the background
    let checkDevToolsOpen = setInterval(function() {
        const element = new Image();
        element.__defineGetter__('id', function() {
            throw 'DevTools detected';
        });
        try {
            console.log(element);
            console.clear();
        } catch (e) {
            document.body.innerHTML = "<h1>Developer Tools are disabled on this page.</h1>";
            clearInterval(checkDevToolsOpen);
        }
    }, 1000);