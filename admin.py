# --- THE SECRET SERVER DATA ---
# This is the master list of owners stored safely on the server
secret_owner_list = ["admin", "kobochat_creator", "boss"]

# --- THE GAME START ---
print("--- WELCOME TO THE RPG REALM ---")
character_name = input("Enter your character's name: ")

# Lowercase the input so capital letters don't mess it up
character_name = character_name.lower()

# --- THE PERMISSION CHECK ---
# The computer checks if your name is on the secret list
if character_name in secret_owner_list:
    user_role = "owner"
    print("\n[SUCCESS] Identity verified.")
    print(f"Welcome back, {character_name.upper()}. Admin powers activated!")
    print("Commands unlocked: /ban_user, /give_gold, /shutdown_server")
else:
    user_role = "player"
    print("\n[GUEST] Character created successfully.")
    print(f"Hello, {character_name}. You are a standard player.")
    print("Commands unlocked: /walk, /chat, /look")

print("\n--- GAME OVER ---")
