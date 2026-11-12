async function enterSecureCabinet() {
  // 1. Open a browser popup for the user to type the passcode
  const userInput = prompt("ENTER PASSCODE:");

  // Stop if the user clicked Cancel or left it blank
  if (!userInput) return;

  // 2. Scramble the text with SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(userInput);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  // 3. Convert the scrambled bytes into a readable 64-character string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const userHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  // 4. Compare it to your saved hash
  const savedHash = "c81818739569ce5d0671c63e329f79bfd0f37727e3eca7b940bc56c0ad9cbcdd";

  if (userHash === savedHash) {
    alert("Access Granted!");
    // Optional: redirect them to your chat page
    // window.location.href = "chat.html";
  } else {
    alert("Wrong passcode!");
  }
}
