OXR JARVIS backend update

This package contains an improved server.js and a valid package.json based on the code shared in chat. It does NOT replace the existing public/ files, so your Holographic interface remains untouched.

Apply:
1. Back up your current server.js and package.json.
2. Replace those two files with the included versions.
3. Run: npm install
4. Ensure .env contains GEMINI_API_KEY=your_key (never share the key).
5. Run: npm start

Included: API request timeouts, improved HTML extraction, normalized conversation history, optional mode="developer", better API error reporting.

Not included yet: actual Windows command execution. That needs a separate allowlisted command layer and a confirmation UI. Voice-language selection and persistent cross-chat memory require an exact frontend app.js patch and are not claimed as completed here.
