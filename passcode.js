function enterSecureCabinet() {
    // 1. Open a system native prompt box (incredibly low resource usage)
    var userInput = prompt("ENTER SECURE CABINET PIN CODE:");
    
    // 2. Define your desired secret key/PIN here (e.g., "1234")
    var secretPin = "0316"; 
    
    if (userInput === null) {
        // User clicked cancel
        return; 
    }
    
    if (userInput === secretPin) {
        // PIN matches! Send them to your book requests file
        // (Change 'chat.html' to the actual name of your file if it's different)
        window.location.href = "chat.html"; 
    } else {
        // Wrong entry
        alert("ACCESS DENIED: INVALID CABINET CREDENTIALS.");
    }
}