class WebPet {
    constructor() {
      this.name = "Buddy";
      this.happiness = 100;
      this.energy = 100;
      this.productivity = 0;
      this.hunger = 100; // New hunger stat - 100% is full, 0% is very hungry
      this.coins = 0;
      this.toys = [];
      this.food = ["Kibble"];
      this.friends = [];
      this.currentState = "idle"; // track the current state of the pet
      this.sleepIntervalId = null; // To track sleep interval for energy recharging
      this.hungerIntervalId = null; // To track hunger depletion interval
      
      // Load the API key from storage first
      this.loadApiKey().then(() => {
        // Initialize everything else after loading API key
        this.initializeEventListeners();
        this.loadState();
        this.initializeTabs();
        this.setupVoiceRecognition();
        this.setupMiniGames();
        this.setupAIChat();
        
        // Add a random movement every 10 seconds
        setInterval(() => this.randomMovement(), 10000);
        
        // Start hunger depletion - loses 1% hunger every 60 seconds
        this.hungerIntervalId = setInterval(() => this.depleteHunger(), 60000);
        
        // Check energy level every 5 seconds for auto-sleep
        setInterval(() => this.checkEnergyForSleep(), 5000);
        
        // Update pet image based on current state
        this.updatePetImage();
      });
    }
    
    // Load API key from storage
    loadApiKey() {
      return new Promise((resolve) => {
        chrome.storage.local.get(['geminiApiKey'], (result) => {
          if (result.geminiApiKey) {
            // Update the in-memory config
            CONFIG.GEMINI_API_KEY = result.geminiApiKey;
          }
          resolve();
        });
      });
    }
    
    // Gradually reduce hunger over time
    depleteHunger() {
      if (this.hunger > 0) {
        this.hunger -= 1;
        this.updateDisplay();
        
        // If very hungry (below 20%), affect happiness
        if (this.hunger < 20 && this.happiness > 0) {
          this.happiness -= 2;
          this.updateDisplay();
          
          if (this.hunger < 10) {
            this.showNotification(`${this.name} is very hungry! Please feed me!`);
          }
        }
      }
    }
    
    // Check if energy is too low and start sleeping if needed
    checkEnergyForSleep() {
      if (this.energy < 10 && this.currentState !== 'sleeping') {
        this.startSleeping();
      }
    }
    
    // Start sleeping to recharge energy
    startSleeping() {
      if (this.currentState === 'sleeping') return; // Already sleeping
      
      this.currentState = 'sleeping';
      this.updatePetImage();
      this.showNotification(`${this.name} is too tired and fell asleep!`);
      
      // Set up interval to recharge energy over time
      // Will recharge 100% in 10 seconds (1% every 100ms)
      this.sleepIntervalId = setInterval(() => {
        this.energy += 1;
        
        // Cap energy at 100%
        if (this.energy >= 100) {
          this.energy = 100;
          this.wakeUp();
        }
        
        this.updateDisplay();
      }, 100);
    }
    
    // Wake up after energy is recharged
    wakeUp() {
      if (this.sleepIntervalId) {
        clearInterval(this.sleepIntervalId);
        this.sleepIntervalId = null;
      }
      
      this.currentState = 'idle';
      this.updatePetImage();
      this.showNotification(`${this.name} woke up feeling refreshed!`);
    }
    
    // Update pet image based on current state
    updatePetImage() {
      const petImg = document.getElementById('pet-sprite');
      switch(this.currentState) {
        case 'working':
          petImg.src = 'images/dogwork.png';
          break;
        case 'sleeping':
          petImg.src = 'images/dogsleep.png';
          break;
        case 'eating':
          petImg.src = 'images/dogeat.png';
          break;
        default:
          petImg.src = 'images/dog.png'; // idle state
      }
    }
  
    initializeEventListeners() {
      document.getElementById('work-btn').addEventListener('click', () => this.work());
      document.getElementById('play-btn').addEventListener('click', () => this.play());
      document.getElementById('feed-btn').addEventListener('click', () => this.feed());
      document.getElementById('voice-btn').addEventListener('click', () => this.toggleVoiceRecognition());
      document.getElementById('pet-sprite').addEventListener('click', () => this.petInteraction());
      document.getElementById('find-friend-btn').addEventListener('click', () => this.findFriends());
      document.getElementById('send-btn').addEventListener('click', () => this.sendAIChat());
      
      // Enter key for chat input
      document.getElementById('ai-prompt').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.sendAIChat();
      });
      
      // Settings/options link
      document.getElementById('options-link').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
      });
      
      // Setup storage change listener to detect settings changes
      chrome.storage.onChanged.addListener((changes, namespace) => {
        for (let key in changes) {
          if (key === 'petState') {
            const newValue = changes[key].newValue;
            if (newValue) {
              // Update pet name in UI
              if (newValue.name) {
                this.name = newValue.name;
                document.getElementById('pet-name').textContent = this.name;
              }
              
              // Update other states if needed
              if (newValue.happiness !== undefined) this.happiness = newValue.happiness;
              if (newValue.energy !== undefined) this.energy = newValue.energy;
              if (newValue.productivity !== undefined) this.productivity = newValue.productivity;
              if (newValue.hunger !== undefined) this.hunger = newValue.hunger;
              
              // Update the display
              this.updateDisplay();
            }
          } else if (key === 'geminiApiKey') {
            // Update API key in memory
            if (changes[key].newValue) {
              CONFIG.GEMINI_API_KEY = changes[key].newValue;
              // Update API status
              this.checkAPIKey();
            }
          }
        }
      });
    }
  
    initializeTabs() {
      const tabs = document.querySelectorAll('.tab-btn');
      const panels = document.querySelectorAll('.tab-panel');
      
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          // Remove active class from all tabs and panels
          tabs.forEach(t => t.classList.remove('active'));
          panels.forEach(p => p.classList.remove('active'));
          
          // Add active class to current tab and panel
          tab.classList.add('active');
          const panel = document.getElementById(`${tab.dataset.tab}-tab`);
          panel.classList.add('active');
        });
      });
    }
  
    work() {
      // Don't allow working while sleeping
      if (this.currentState === 'sleeping') {
        this.showNotification(`${this.name} is sleeping. Let me rest!`);
        return;
      }
      
      if (this.energy > 10) {
        // Change state to working
        this.currentState = 'working';
        this.updatePetImage();
        
        this.productivity += 10;
        this.energy -= 10;
        this.happiness = Math.max(0, this.happiness - 5); // Ensure doesn't go below 0
        this.hunger = Math.max(0, this.hunger - 5); // Working makes hungry
        this.coins += 5;
        this.playSound('work');
        this.updateDisplay();
        this.showNotification('Work completed! Earned 5 coins!');
        
        // Return to idle state after 3 seconds
        setTimeout(() => {
          if (this.currentState === 'working') { // Only if still working
            this.currentState = 'idle';
            this.updatePetImage();
          }
        }, 3000);
      } else {
        this.showNotification("Your pet is too tired to work!");
        
        // Auto-sleep when trying to work with low energy
        this.startSleeping();
      }
    }
  
    play() {
      // Don't allow playing while sleeping
      if (this.currentState === 'sleeping') {
        this.showNotification(`${this.name} is sleeping. Let me rest!`);
        return;
      }
      
      if (this.energy > 10) {
        // Set idle state but with special animation
        this.currentState = 'idle';
        this.updatePetImage();
        
        this.happiness = Math.min(100, this.happiness + 10); // Cap at 100%
        this.energy = Math.max(0, this.energy - 5); // Ensure doesn't go below 0
        this.hunger = Math.max(0, this.hunger - 2); // Playing makes a bit hungry
        this.coins += 2;
        this.playSound('happy');
        this.updateDisplay();
        
        // Animate the pet
        const pet = document.getElementById('pet-sprite');
        pet.classList.add('bounce');
        
        // Apply a different animation than the normal idle state
        pet.style.animation = 'bounce 0.5s infinite alternate';
        
        // Return to normal after 3 seconds
        setTimeout(() => {
          pet.classList.remove('bounce');
          pet.style.animation = '';
        }, 3000);
      } else {
        this.showNotification("Your pet needs rest!");
        
        // Auto-sleep when trying to play with low energy
        this.startSleeping();
      }
    }
  
    feed() {
      // Can feed while sleeping - will wake pet up
      if (this.currentState === 'sleeping') {
        this.wakeUp();
      }
      
      // Change state to eating
      this.currentState = 'eating';
      this.updatePetImage();
      
      this.energy = Math.min(100, this.energy + 10); // Eating gives some energy
      this.happiness = Math.min(100, this.happiness + 5); // Cap at 100%
      this.hunger = Math.min(100, this.hunger + 30); // Replenish hunger (capped at 100%)
      this.playSound('eat');
      this.updateDisplay();
      
      // Return to idle state after 3 seconds
      setTimeout(() => {
        if (this.currentState === 'eating') { // Only if still eating
          this.currentState = 'idle';
          this.updatePetImage();
        }
      }, 3000);
    }
  
    petInteraction() {
      // Don't interact while sleeping
      if (this.currentState === 'sleeping') {
        this.showNotification(`Shh... ${this.name} is sleeping.`);
        return;
      }
      
      this.happiness = Math.min(100, this.happiness + 5); // Cap at 100%
      this.playSound('happy');
      
      // Animate the pet
      const pet = document.getElementById('pet-sprite');
      pet.classList.add('bounce');
      setTimeout(() => pet.classList.remove('bounce'), 500);
      
      this.updateDisplay();
    }
  
    randomMovement() {
      // Only do random movements in idle state and not sleeping
      if (this.currentState === 'idle') {
        if (Math.random() > 0.7) {
          const pet = document.getElementById('pet-sprite');
          pet.classList.add('bounce');
          setTimeout(() => pet.classList.remove('bounce'), 500);
          this.playSound('idle');
        }
        
        // Randomly go to sleep if energy is below 30%
        if (this.energy < 30 && Math.random() > 0.8) {
          this.startSleeping();
        }
      }
    }
  
    updateDisplay() {
      // Cap all values to ensure they don't exceed bounds
      this.happiness = Math.min(100, Math.max(0, this.happiness));
      this.energy = Math.min(100, Math.max(0, this.energy));
      this.productivity = Math.min(100, Math.max(0, this.productivity));
      this.hunger = Math.min(100, Math.max(0, this.hunger));
      
      // Update text values
      document.getElementById('happiness').textContent = `${this.happiness}%`;
      document.getElementById('energy').textContent = `${this.energy}%`;
      document.getElementById('productivity').textContent = `${this.productivity}%`;
      document.getElementById('hunger').textContent = `${this.hunger}%`;
      document.getElementById('pet-name').textContent = this.name;
      
      // Update progress bars
      document.querySelector('.happiness-fill').style.width = `${this.happiness}%`;
      document.querySelector('.energy-fill').style.width = `${this.energy}%`;
      document.querySelector('.productivity-fill').style.width = `${this.productivity}%`;
      document.querySelector('.hunger-fill').style.width = `${this.hunger}%`;
      
      // Save state
      this.saveState();
    }
  
    saveState() {
      chrome.storage.local.set({
        petState: {
          name: this.name,
          happiness: this.happiness,
          energy: this.energy,
          productivity: this.productivity,
          hunger: this.hunger,
          coins: this.coins,
          toys: this.toys,
          food: this.food,
          friends: this.friends
        }
      });
    }
  
    loadState() {
      chrome.storage.local.get(['petState'], (result) => {
        if (result.petState) {
          this.happiness = result.petState.happiness || 100;
          this.energy = result.petState.energy || 100;
          this.productivity = result.petState.productivity || 0;
          this.hunger = result.petState.hunger !== undefined ? result.petState.hunger : 100;
          this.coins = result.petState.coins || 0;
          this.toys = result.petState.toys || [];
          this.food = result.petState.food || ["Kibble"];
          this.friends = result.petState.friends || [];
          this.name = result.petState.name || "Buddy";
          this.updateDisplay();
        }
      });
    }
    
    // Voice recognition feature
    setupVoiceRecognition() {
      if ('webkitSpeechRecognition' in window) {
        this.recognition = new webkitSpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
        
        this.recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript.toLowerCase();
          this.processVoiceCommand(transcript);
        };
        
        this.recognition.onerror = (event) => {
          console.error('Speech recognition error', event.error);
          this.showNotification('Voice recognition error: ' + event.error);
        };
      } else {
        document.getElementById('voice-btn').style.display = 'none';
        console.warn('Web Speech API is not supported in this browser');
      }
    }
    
    toggleVoiceRecognition() {
      if (this.isListening) {
        this.recognition.stop();
        this.isListening = false;
        document.getElementById('voice-btn').innerHTML = '<i class="fas fa-microphone"></i>';
      } else {
        this.recognition.start();
        this.isListening = true;
        document.getElementById('voice-btn').innerHTML = '<i class="fas fa-microphone-slash"></i>';
        this.showNotification('Listening...');
      }
    }
    
    processVoiceCommand(transcript) {
      console.log('Processing voice command:', transcript);
      
      if (transcript.includes('work') || transcript.includes('task')) {
        this.work();
      } else if (transcript.includes('play') || transcript.includes('game')) {
        this.play();
      } else if (transcript.includes('feed') || transcript.includes('food')) {
        this.feed();
      } else if (transcript.includes('hello') || transcript.includes('hi')) {
        this.playSound('happy');
        this.showNotification('Hello there! How can I help?');
      } else {
        // If no command is recognized, send to AI chat
        document.getElementById('ai-prompt').value = transcript;
        this.sendAIChat();
      }
    }
    
    // Mini-games feature
    setupMiniGames() {
      const gameItems = document.querySelectorAll('.game-item');
      
      gameItems.forEach(game => {
        game.addEventListener('click', () => {
          const gameType = game.dataset.game;
          this.loadGame(gameType);
        });
      });
    }
    
    loadGame(gameType) {
      const gameArea = document.getElementById('game-area');
      gameArea.style.display = 'block';
      gameArea.innerHTML = '';
      
      switch(gameType) {
        case 'fetch':
          this.setupFetchGame(gameArea);
          break;
        case 'chase':
          this.setupChaseGame(gameArea);
          break;
        case 'puzzle':
          this.setupPuzzleGame(gameArea);
          break;
        default:
          gameArea.innerHTML = '<p>Game not available</p>';
      }
    }
    
    setupFetchGame(gameArea) {
      gameArea.innerHTML = `
        <div id="fetch-game">
          <div id="fetch-ball"></div>
          <button id="throw-btn">Throw Ball</button>
        </div>
      `;
      
      const ball = document.getElementById('fetch-ball');
      const throwBtn = document.getElementById('throw-btn');
      
      ball.style.cssText = `
        width: 20px;
        height: 20px;
        background-color: red;
        border-radius: 50%;
        position: relative;
        left: 0;
        transition: left 1s ease;
      `;
      
      throwBtn.addEventListener('click', () => {
        ball.style.left = '80%';
        this.playSound('play');
        
        setTimeout(() => {
          ball.style.left = '0';
          this.happiness += 5;
          this.energy -= 2;
          this.updateDisplay();
        }, 2000);
      });
    }
    
    setupChaseGame(gameArea) {
      gameArea.innerHTML = `
        <div id="chase-game">
          <div id="mouse"></div>
          <p>Click on the mouse! Score: <span id="chase-score">0</span></p>
        </div>
      `;
      
      const mouse = document.getElementById('mouse');
      let score = 0;
      
      mouse.style.cssText = `
        width: 30px;
        height: 30px;
        background-color: gray;
        border-radius: 15px;
        position: absolute;
        cursor: pointer;
      `;
      
      const moveTarget = () => {
        const x = Math.floor(Math.random() * (gameArea.offsetWidth - 30));
        const y = Math.floor(Math.random() * (gameArea.offsetHeight - 30));
        mouse.style.left = `${x}px`;
        mouse.style.top = `${y}px`;
      };
      
      moveTarget();
      
      mouse.addEventListener('click', () => {
        score++;
        document.getElementById('chase-score').textContent = score;
        this.playSound('happy');
        moveTarget();
        
        if (score % 5 === 0) {
          this.happiness += 10;
          this.energy -= 5;
          this.coins += 3;
          this.updateDisplay();
        }
      });
    }
    
    setupPuzzleGame(gameArea) {
      const colors = ['red', 'blue', 'green', 'yellow'];
      const gamePattern = [];
      let userPattern = [];
      let level = 0;
      
      gameArea.innerHTML = `
        <div id="puzzle-game">
          <div id="puzzle-buttons"></div>
          <button id="start-puzzle">Start Puzzle</button>
          <p>Level: <span id="puzzle-level">0</span></p>
        </div>
      `;
      
      const puzzleButtons = document.getElementById('puzzle-buttons');
      const startBtn = document.getElementById('start-puzzle');
      
      puzzleButtons.style.cssText = `
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin: 10px 0;
      `;
      
      colors.forEach(color => {
        const button = document.createElement('div');
        button.id = `${color}-btn`;
        button.style.cssText = `
          width: 60px;
          height: 60px;
          background-color: ${color};
          border-radius: 5px;
          cursor: pointer;
          opacity: 0.6;
        `;
        
        button.addEventListener('click', () => {
          userPattern.push(color);
          highlightButton(button);
          
          if (userPattern.length === gamePattern.length) {
            if (checkPatterns()) {
              setTimeout(() => nextLevel(), 1000);
            } else {
              gameOver();
            }
          }
        });
        
        puzzleButtons.appendChild(button);
      });
      
      startBtn.addEventListener('click', startGame);
      
      function startGame() {
        level = 0;
        gamePattern.length = 0;
        userPattern.length = 0;
        nextLevel();
      }
      
      const nextLevel = () => {
        userPattern = [];
        level++;
        document.getElementById('puzzle-level').textContent = level;
        
        const randomColor = colors[Math.floor(Math.random() * 4)];
        gamePattern.push(randomColor);
        
        setTimeout(() => showPattern(), 500);
        
        if (level % 3 === 0) {
          this.happiness += 15;
          this.coins += 5;
          this.updateDisplay();
        }
      };
      
      function showPattern() {
        let i = 0;
        
        const interval = setInterval(() => {
          if (i >= gamePattern.length) {
            clearInterval(interval);
            return;
          }
          
          const color = gamePattern[i];
          const button = document.getElementById(`${color}-btn`);
          highlightButton(button);
          i++;
        }, 800);
      }
      
      function highlightButton(button) {
        button.style.opacity = '1';
        setTimeout(() => {
          button.style.opacity = '0.6';
        }, 300);
      }
      
      function checkPatterns() {
        for (let i = 0; i < userPattern.length; i++) {
          if (userPattern[i] !== gamePattern[i]) {
            return false;
          }
        }
        return true;
      }
      
      const gameOver = () => {
        alert(`Game over! You reached level ${level}`);
        if (level > 5) {
          this.coins += level;
          this.updateDisplay();
        }
      };
    }
    
    // Social features
    findFriends() {
      // In a real implementation, this would connect to a server
      // For demo purposes, we'll simulate finding random friends
      const randomFriends = [
        { name: "Max", petType: "Dog" },
        { name: "Luna", petType: "Cat" },
        { name: "Rocky", petType: "Rabbit" },
        { name: "Charlie", petType: "Dog" },
        { name: "Bella", petType: "Cat" }
      ];
      
      const friendsList = document.getElementById('friends-list');
      friendsList.innerHTML = '<p>Searching for friends...</p>';
      
      setTimeout(() => {
        const randomFriend = randomFriends[Math.floor(Math.random() * randomFriends.length)];
        this.friends.push(randomFriend);
        
        let friendsHTML = '';
        this.friends.forEach(friend => {
          friendsHTML += `<div class="friend-item">
            <p>${friend.name} (${friend.petType})</p>
            <button class="visit-btn" data-friend="${friend.name}">Visit</button>
          </div>`;
        });
        
        friendsList.innerHTML = friendsHTML;
        
        // Add event listeners to visit buttons
        document.querySelectorAll('.visit-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const friendName = btn.dataset.friend;
            this.visitFriend(friendName);
          });
        });
        
        this.saveState();
      }, 2000);
    }
    
    visitFriend(friendName) {
      const friendsList = document.getElementById('friends-list');
      friendsList.innerHTML = `
        <div class="friend-visit">
          <p>Visiting ${friendName}'s pet!</p>
          <p>You can play together or exchange gifts.</p>
          <button id="play-together">Play Together</button>
          <button id="back-to-friends">Back</button>
        </div>
      `;
      
      document.getElementById('play-together').addEventListener('click', () => {
        this.happiness += 15;
        this.playSound('happy');
        this.updateDisplay();
        this.showNotification(`Playing with ${friendName} was fun!`);
      });
      
      document.getElementById('back-to-friends').addEventListener('click', () => {
        let friendsHTML = '';
        this.friends.forEach(friend => {
          friendsHTML += `<div class="friend-item">
            <p>${friend.name} (${friend.petType})</p>
            <button class="visit-btn" data-friend="${friend.name}">Visit</button>
          </div>`;
        });
        
        friendsList.innerHTML = friendsHTML;
        
        // Add event listeners to visit buttons
        document.querySelectorAll('.visit-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const friendName = btn.dataset.friend;
            this.visitFriend(friendName);
          });
        });
      });
    }
    
    // AI Chat feature
    setupAIChat() {
      this.chatHistory = [];
      this.updateChatUI();
      this.checkAPIKey();
    }
    
    checkAPIKey() {
      const apiStatus = document.getElementById('api-status');
      
      if (CONFIG.GEMINI_API_KEY === "YOUR_API_KEY") {
        apiStatus.innerHTML = '<p style="color: red; font-size: 12px;">⚠️ Please set your Gemini API key in config.js</p>';
      } else {
        apiStatus.innerHTML = '<p style="color: green; font-size: 12px;">✓ Gemini API connected</p>';
        
        // Test the API
        this.testGeminiAPI();
      }
    }
    
    testGeminiAPI() {
      // Direct API call using fetch
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.MODEL_NAME}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
      
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: "Say hello" }
              ]
            }
          ],
          generationConfig: {
            temperature: CONFIG.TEMPERATURE,
            maxOutputTokens: CONFIG.MAX_OUTPUT_TOKENS
          }
        })
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log("Gemini API test successful");
      })
      .catch(error => {
        console.error("Gemini API test failed:", error);
        const apiStatus = document.getElementById('api-status');
        apiStatus.innerHTML = `<p style="color: red; font-size: 12px;">⚠️ API Error: ${error.message}</p>`;
      });
    }
    
    sendAIChat() {
      const prompt = document.getElementById('ai-prompt').value.trim();
      if (!prompt) return;
      
      // Add user message to chat
      this.chatHistory.push({ role: 'user', content: prompt });
      this.updateChatUI();
      
      // Clear input
      document.getElementById('ai-prompt').value = '';
      
      // Show thinking indicator
      const chatMessages = document.getElementById('chat-messages');
      const thinkingEl = document.createElement('div');
      thinkingEl.className = 'chat-message pet-message thinking';
      thinkingEl.textContent = '...';
      chatMessages.appendChild(thinkingEl);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      
      // Check if API key is set
      if (CONFIG.GEMINI_API_KEY === "YOUR_API_KEY") {
        chatMessages.removeChild(thinkingEl);
        this.fallbackResponse(prompt);
        return;
      }
      
      // Call Gemini API using direct fetch
      this.callGeminiAPI(prompt)
        .then(response => {
          chatMessages.removeChild(thinkingEl);
          
          // Add pet response to chat
          this.chatHistory.push({ role: 'assistant', content: response });
          this.updateChatUI();
          this.playSound('bark');
        })
        .catch(error => {
          console.error("Error calling Gemini API:", error);
          chatMessages.removeChild(thinkingEl);
          
          // Fall back to local response on error
          this.fallbackResponse(prompt);
        });
    }
    
    async callGeminiAPI(prompt) {
      try {
        // Construct the system prompt
        const systemPrompt = `You are a virtual pet named ${this.name}. Your personality is ${CONFIG.PET_PERSONALITY}. 
          Reply as if you are a cute virtual pet helping your owner. Keep responses concise and playful.
          Current pet stats: Happiness: ${this.happiness}%, Energy: ${this.energy}%, Hunger: ${this.hunger}%, Productivity: ${this.productivity}%`;
        
        // Prepare conversation history
        const history = this.chatHistory.slice(-10).map(msg => ({
          role: msg.role,
          parts: [{ text: msg.content }]
        }));
        
        // Add system prompt to the beginning of the contents array
        const contents = [
          {
            role: 'user',
            parts: [{ text: systemPrompt }]
          },
          ...history,
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ];
        
        // Make direct API call
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.MODEL_NAME}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: contents,
            generationConfig: {
              temperature: CONFIG.TEMPERATURE,
              maxOutputTokens: CONFIG.MAX_OUTPUT_TOKENS
            }
          })
        });
        
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        
        // Extract text from response
        if (data.candidates && 
            data.candidates[0] && 
            data.candidates[0].content && 
            data.candidates[0].content.parts && 
            data.candidates[0].content.parts[0]) {
          return data.candidates[0].content.parts[0].text;
        } else {
          throw new Error('Unexpected API response format');
        }
      } catch (error) {
        console.error("Error in Gemini API call:", error);
        throw error;
      }
    }
    
    fallbackResponse(prompt) {
      // This is used when the API fails or isn't configured
      console.log("Using fallback response system");
      
      let response = '';
      
      if (prompt.toLowerCase().includes('help')) {
        response = "I can help you stay productive and have fun! Try saying 'work', 'play', or 'feed' to interact with me.";
      } else if (prompt.toLowerCase().includes('work') || prompt.toLowerCase().includes('task') || prompt.toLowerCase().includes('productive')) {
        response = "Need to be productive? Try using the work button to earn coins and increase your productivity score!";
      } else if (prompt.toLowerCase().includes('play') || prompt.toLowerCase().includes('game')) {
        response = "Want to have fun? Check out the Games tab for mini-games we can play together!";
      } else if (prompt.toLowerCase().includes('friend') || prompt.toLowerCase().includes('social')) {
        response = "Looking for some company? Go to the Social tab to find and connect with friends!";
      } else if (prompt.toLowerCase().includes('hello') || prompt.toLowerCase().includes('hi')) {
        response = "Hello there! How can I help you today?";
      } else if (prompt.toLowerCase().includes('who are you') || prompt.toLowerCase().includes('your name')) {
        response = `I'm ${this.name}, your virtual pet and productivity companion!`;
      } else if (prompt.toLowerCase().includes('feed') || prompt.toLowerCase().includes('food') || prompt.toLowerCase().includes('hungry')) {
        response = "Feeling hungry? Use the feed button to give me some energy!";
      } else if (prompt.toLowerCase().includes('api') || prompt.toLowerCase().includes('gemini')) {
        response = "The Gemini API isn't configured yet. Please add your API key in the config.js file!";
      } else {
        // Generic responses for other queries
        const genericResponses = [
          "That's interesting! Is there anything specific you'd like to do together?",
          "I'm here to help you stay productive and have fun!",
          "Would you like to play a game or get some work done?",
          "I'm still learning, but I'm here to be your companion!",
          "Woof! I mean... I'm here to assist you!"
        ];
        response = genericResponses[Math.floor(Math.random() * genericResponses.length)];
      }
      
      // Add pet response to chat
      this.chatHistory.push({ role: 'assistant', content: response });
      this.updateChatUI();
      this.playSound('bark');
    }
    
    updateChatUI() {
      const chatMessages = document.getElementById('chat-messages');
      chatMessages.innerHTML = '';
      
      this.chatHistory.forEach(msg => {
        const messageEl = document.createElement('div');
        messageEl.className = msg.role === 'user' ? 'chat-message user-message' : 'chat-message pet-message';
        messageEl.textContent = msg.content;
        chatMessages.appendChild(messageEl);
      });
      
      // Scroll to bottom
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Utility functions
    showNotification(message) {
      if (Notification.permission === 'granted') {
        new Notification('WebPets', { body: message });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification('WebPets', { body: message });
          }
        });
      }
      
      // Fallback for when notifications aren't allowed
      const notifications = document.createElement('div');
      notifications.className = 'notification';
      notifications.textContent = message;
      document.body.appendChild(notifications);
      
      setTimeout(() => {
        notifications.style.opacity = '0';
        setTimeout(() => document.body.removeChild(notifications), 500);
      }, 3000);
    }
    
    playSound(soundType) {
      // In a real implementation, this would play actual sound files
      console.log(`Playing sound: ${soundType}`);
      
      // If Web Audio API is implemented, could create sounds here
      // For now, just log the sound type
    }
  }
  
  // Initialize the pet when the popup loads
  document.addEventListener('DOMContentLoaded', () => {
    const pet = new WebPet();
    
    // Set up runtime message listener for settings updates
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'settingsUpdated') {
        console.log('Settings update detected:', request);
        
        if (request.key === 'apiKey') {
          // Refresh the API status
          pet.checkAPIKey();
        } 
        else if (request.key === 'petName' && request.name) {
          // Update pet name
          pet.name = request.name;
          document.getElementById('pet-name').textContent = pet.name;
        }
      }
      return true;
    });
  });
  
  // Add CSS for notifications
  const style = document.createElement('style');
  style.textContent = `
    .notification {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      z-index: 1000;
      transition: opacity 0.5s;
    }
    
    .chat-message {
      margin: 5px 0;
      padding: 8px 12px;
      border-radius: 8px;
      max-width: 80%;
    }
    
    .user-message {
      background-color: #e1f5fe;
      align-self: flex-end;
      margin-left: auto;
    }
    
    .pet-message {
      background-color: #f0f0f0;
      align-self: flex-start;
    }
    
    .thinking {
      opacity: 0.7;
    }
    
    #api-status {
      margin-top: 10px;
      text-align: center;
    }
  `;
  document.head.appendChild(style);