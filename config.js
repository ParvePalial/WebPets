// WebPets API Configuration
const CONFIG = {
  // Gemini API Key
  GEMINI_API_KEY: "YOUR_API_KEY", // Replace with your actual API key
  
  // Model Settings
  MODEL_NAME: "gemini-2.0-flash",
  TEMPERATURE: 0.7,
  MAX_OUTPUT_TOKENS: 256,
  
  // Pet Personality
  PET_PERSONALITY: "friendly, helpful, playful, enthusiastic"
};

// Don't modify this line
if (typeof module !== 'undefined') module.exports = CONFIG; 