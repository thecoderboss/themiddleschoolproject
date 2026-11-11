async function enterSecureCabinet() {
  // 1. Get what the user typed
  const userInput = document.getElementById("passcodeInput").value;

  // 2. Turn the text into computer bytes and scramble it with SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(userInput);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  // 3. Convert the scrambled bytes into a readable 64-character string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const userHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  // 4. Compare it to your saved hash
  const savedHash = "c81818739569ce5d0671c63e329f79bfd0f37727e3eca7b940bc56c0ad9cbcdd";

  if (userHash === savedHash) {
    document.getElementById("message").innerText = "Access Granted!";
  } else {
    document.getElementById("message").innerText = "Wrong passcode!";
  }
}
