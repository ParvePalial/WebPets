// WebPets Options Page
document.addEventListener('DOMContentLoaded', function() {
  // Load saved settings
  loadSavedSettings();
  
  // Event listeners for save buttons
  document.getElementById('save-api-key').addEventListener('click', saveApiKey);
  document.getElementById('save-pet-name').addEventListener('click', savePetName);
});

// Load any previously saved settings
function loadSavedSettings() {
  // Load Gemini API key
  chrome.storage.local.get(['geminiApiKey'], function(result) {
    if (result.geminiApiKey) {
      // Mask the API key for security
      const apiKey = result.geminiApiKey;
      const maskedKey = maskApiKey(apiKey);
      document.getElementById('gemini-api-key').value = maskedKey;
      document.getElementById('gemini-api-key').dataset.masked = 'true';
    }
  });
  
  // Load pet name
  chrome.storage.local.get(['petState'], function(result) {
    if (result.petState && result.petState.name) {
      document.getElementById('pet-name').value = result.petState.name;
    }
  });
  
  // Clear the input when clicked if it's masked
  document.getElementById('gemini-api-key').addEventListener('focus', function() {
    if (this.dataset.masked === 'true') {
      this.value = '';
      this.dataset.masked = 'false';
    }
  });
}

// Save Gemini API key
function saveApiKey() {
  const apiKey = document.getElementById('gemini-api-key').value.trim();
  const statusMsg = document.getElementById('status-message');
  
  if (!apiKey) {
    showStatus(statusMsg, 'Please enter an API key.', 'error');
    return;
  }
  
  // Test the API key before saving
  testApiKey(apiKey)
    .then(() => {
      // Save the API key
      chrome.storage.local.set({ geminiApiKey: apiKey }, function() {
        showStatus(statusMsg, 'API key saved successfully!', 'success');
        
        // Update the config in memory
        updateConfigInMemory(apiKey);
        
        // Mask the API key for security
        const maskedKey = maskApiKey(apiKey);
        document.getElementById('gemini-api-key').value = maskedKey;
        document.getElementById('gemini-api-key').dataset.masked = 'true';
        
        // Notify all open extension pages of the change
        chrome.runtime.sendMessage({ action: 'settingsUpdated', key: 'apiKey' });
      });
    })
    .catch(error => {
      showStatus(statusMsg, `Error: ${error.message}`, 'error');
    });
}

// Test the API key before saving
function testApiKey(apiKey) {
  return new Promise((resolve, reject) => {
    // Use direct fetch API instead of Google GenAI library
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { 
                text: "Hello"
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 30
        }
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`API test failed with status ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log("API test successful");
      resolve();
    })
    .catch(error => {
      console.error("API test error:", error);
      reject(error);
    });
  });
}

// Save pet name
function savePetName() {
  const petName = document.getElementById('pet-name').value.trim();
  const statusMsg = document.getElementById('status-message');
  
  if (!petName) {
    showStatus(statusMsg, 'Please enter a pet name.', 'error');
    return;
  }
  
  // Get current pet state
  chrome.storage.local.get(['petState'], function(result) {
    const petState = result.petState || {};
    petState.name = petName;
    
    // Save updated state
    chrome.storage.local.set({ petState: petState }, function() {
      showStatus(statusMsg, `Pet name saved! Your pet is now named ${petName}!`, 'success');
      
      // Notify all open extension pages of the change
      chrome.runtime.sendMessage({ action: 'settingsUpdated', key: 'petName', name: petName });
    });
  });
}

// Utility: Show status message
function showStatus(element, message, type) {
  element.textContent = message;
  element.className = `status ${type}`;
  
  // Clear after 3 seconds
  setTimeout(() => {
    element.textContent = '';
    element.className = '';
  }, 3000);
}

// Utility: Mask API key for display
function maskApiKey(apiKey) {
  if (apiKey.length <= 8) {
    return '••••••••';
  }
  
  const firstFour = apiKey.substring(0, 4);
  const lastFour = apiKey.substring(apiKey.length - 4);
  const masked = '•'.repeat(apiKey.length - 8);
  
  return `${firstFour}${masked}${lastFour}`;
}

// Update config in memory to use in current session
function updateConfigInMemory(apiKey) {
  if (typeof CONFIG !== 'undefined') {
    CONFIG.GEMINI_API_KEY = apiKey;
  }
} 