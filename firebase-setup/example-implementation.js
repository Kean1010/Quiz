// Example implementation of Firebase integration for Quiz Party
// This file shows how to replace key LocalStorage functions with Firebase

// Initialize Firebase (you'll need to add your config)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ===== CREATE QUIZ FUNCTION =====
// Replace your existing createQuizBtn click handler with this:

createQuizBtn.addEventListener('click', async () => {
    // ... (keep all your existing validation code)
    
    // Collect questions data (keep this part)
    const questions = [];
    // ... (your existing question collection code)
    
    // Create quiz data object (keep this part)
    const quizData = {
        title: quizTitle,
        description: document.getElementById('quiz-description').value.trim(),
        questions: questions
    };
    
    try {
        // Generate game code
        const gameCode = generateGameCode();
        
        // Store quiz data in Firebase (REPLACE LocalStorage with this)
        await database.ref(`quizzes/${gameCode}`).set(quizData);
        
        // Initialize participants list in Firebase
        await database.ref(`participants/${gameCode}`).set({});
        
        // Initialize quiz status in Firebase
        await database.ref(`quiz_status/${gameCode}`).set({
            started: false,
            currentQuestionIndex: 0,
            questionStartTime: null,
            questionResultsVisible: false
        });
        
        // Show success screen (keep this part)
        gameCodeElement.textContent = gameCode;
        
        // Generate QR code (keep this part)
        const qrCodeUrl = `${window.location.origin}${window.location.pathname}?join=${gameCode}`;
        new QRCode(qrCodeElement, {
            text: qrCodeUrl,
            width: 150,
            height: 150,
            colorDark: "#4361ee",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
        
        // Show success screen (keep this part)
        quizFormContainer.classList.add('hidden');
        quizCreatedSuccess.classList.remove('hidden');
        
        // Store host information in LocalStorage (keep this for the host's session)
        localStorage.setItem('isHost', 'true');
        localStorage.setItem('currentGameCode', gameCode);
        
    } catch (error) {
        console.error('Error creating quiz:', error);
        alert('Failed to create quiz. Please try again.');
    }
});

// ===== JOIN QUIZ FUNCTION =====
// Replace your existing joinQuizBtn click handler with this:

joinQuizBtn.addEventListener('click', async () => {
    const gameCode = joinGameCodeInput.value.trim().toUpperCase();
    const playerName = playerNameInput.value.trim();
    
    if (!gameCode) {
        alert('Please enter a game code');
        return;
    }
    
    if (!playerName) {
        alert('Please enter your name');
        return;
    }
    
    try {
        // Check if quiz exists in Firebase (REPLACE LocalStorage check with this)
        const quizSnapshot = await database.ref(`quizzes/${gameCode}`).once('value');
        const quizData = quizSnapshot.val();
        
        if (!quizData) {
            alert('Invalid game code. Please check and try again.');
            return;
        }
        
        // Check if player name already exists (REPLACE LocalStorage check with this)
        const participantsSnapshot = await database.ref(`participants/${gameCode}`).once('value');
        const participants = participantsSnapshot.val() || {};
        
        for (const key in participants) {
            if (participants[key].name === playerName) {
                alert('A player with this name already exists. Please choose a different name.');
                return;
            }
        }
        
        // Add new player to Firebase (REPLACE LocalStorage with this)
        const newPlayer = {
            id: Date.now().toString(),
            name: playerName,
            score: 0,
            answers: []
        };
        
        const playerRef = database.ref(`participants/${gameCode}`).push();
        await playerRef.set(newPlayer);
        
        // Store player information in LocalStorage (keep this for the player's session)
        localStorage.setItem('isHost', 'false');
        localStorage.setItem('currentGameCode', gameCode);
        localStorage.setItem('playerId', playerRef.key);
        
        // Show waiting room (keep this part)
        joinQuizForm.classList.add('hidden');
        waitingRoom.classList.remove('hidden');
        
        // Update quiz title and participants count (keep this part)
        waitingQuizTitle.textContent = quizData.title;
        
        // Start real-time updates instead of polling
        setupPlayerRealTimeUpdates(gameCode);
        
    } catch (error) {
        console.error('Error joining quiz:', error);
        alert('Failed to join quiz. Please try again.');
    }
});

// ===== HOST INTERFACE FUNCTIONS =====

// Replace your initializeHostInterface function with this:
function initializeHostInterface() {
    const gameCode = localStorage.getItem('currentGameCode');
    if (!gameCode) {
        alert('No active quiz found');
        return;
    }
    
    // Update game code and QR code (keep this part)
    hostGameCodeElement.textContent = gameCode;
    
    // Generate QR code (keep this part)
    const qrCodeUrl = `${window.location.origin}${window.location.pathname}?join=${gameCode}`;
    new QRCode(hostQrCodeElement, {
        text: qrCodeUrl,
        width: 150,
        height: 150,
        colorDark: "#4361ee",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
    
    // Set up real-time listeners instead of polling
    setupHostRealTimeUpdates(gameCode);
}

// Replace your startHostPolling function with this:
function setupHostRealTimeUpdates(gameCode) {
    // Listen for participants changes
    database.ref(`participants/${gameCode}`).on('value', (snapshot) => {
        const participants = snapshot.val() || {};
        const participantsArray = Object.values(participants);
        
        // Update participants count
        hostParticipantsCount.textContent = participantsArray.length;
        
        // Update participants list
        participantsList.innerHTML = '';
        if (participantsArray.length === 0) {
            participantsList.innerHTML = '<div class="text-gray-500 italic col-span-full text-center py-4">No participants yet</div>';
            hostStartQuizBtn.disabled = true;
        } else {
            participantsArray.forEach((participant) => {
                const participantElement = document.createElement('div');
                participantElement.className = 'bg-gray-50 rounded-lg p-3 flex items-center';
                participantElement.innerHTML = `
                    <div class="bg-primary/10 text-primary rounded-full w-8 h-8 flex items-center justify-center mr-3">
                        <i class="fa fa-user"></i>
                    </div>
                    <span class="font-medium">${participant.name}</span>
                `;
                participantsList.appendChild(participantElement);
            });
            hostStartQuizBtn.disabled = false;
        }
    });
    
    // Listen for quiz status changes
    database.ref(`quiz_status/${gameCode}`).on('value', (snapshot) => {
        const quizStatus = snapshot.val() || {};
        
        if (quizStatus.started) {
            quizNotStarted.classList.add('hidden');
            quizInProgress.classList.remove('hidden');
            initializeQuizInProgress();
        }
    });
}

// Replace your hostStartQuizBtn click handler with this:
hostStartQuizBtn.addEventListener('click', async () => {
    const gameCode = localStorage.getItem('currentGameCode');
    if (!gameCode) {
        alert('No active quiz found');
        return;
    }
    
    try {
        // Update quiz status in Firebase
        await database.ref(`quiz_status/${gameCode}`).update({
            started: true,
            currentQuestionIndex: 0,
            questionStartTime: Date.now(),
            questionResultsVisible: false
        });
        
        // Hide waiting screen and show quiz in progress (keep this part)
        quizNotStarted.classList.add('hidden');
        quizInProgress.classList.remove('hidden');
        
        // Initialize quiz in progress (keep this part)
        initializeQuizInProgress();
        
    } catch (error) {
        console.error('Error starting quiz:', error);
        alert('Failed to start quiz. Please try again.');
    }
});

// ===== PLAYER INTERFACE FUNCTIONS =====

// Replace your startPlayerPolling function with this:
function setupPlayerRealTimeUpdates(gameCode) {
    // Listen for participants changes
    database.ref(`participants/${gameCode}`).on('value', (snapshot) => {
        const participants = snapshot.val() || {};
        const participantsArray = Object.values(participants);
        
        // Update participants count
        participantsCount.textContent = participantsArray.length;
    });
    
    // Listen for quiz status changes
    database.ref(`quiz_status/${gameCode}`).on('value', (snapshot) => {
        const quizStatus = snapshot.val() || {};
        
        if (quizStatus.started) {
            document.getElementById('quiz-player-interface').classList.remove('hidden');
            document.getElementById('player-quiz-not-started').classList.add('hidden');
            document.getElementById('player-question-active').classList.remove('hidden');
            initializePlayerQuestionActive(quizStatus.currentQuestionIndex);
        }
    });
}

// Replace your submit answer function with this:
async function submitAnswer(answerIndex) {
    const gameCode = localStorage.getItem('currentGameCode');
    const playerId = localStorage.getItem('playerId');
    
    if (!gameCode || !playerId) {
        alert('You are not part of any quiz');
        return;
    }
    
    try {
        // Get current quiz status
        const statusSnapshot = await database.ref(`quiz_status/${gameCode}`).once('value');
        const status = statusSnapshot.val() || {};
        
        const currentQuestionIndex = status.currentQuestionIndex || 0;
        const questionStartTime = status.questionStartTime || Date.now();
        
        // Get quiz data to calculate time remaining
        const quizSnapshot = await database.ref(`quizzes/${gameCode}`).once('value');
        const quizData = quizSnapshot.val();
        
        if (!quizData || !quizData.questions || !quizData.questions[currentQuestionIndex]) {
            alert('Question not found');
            return;
        }
        
        const question = quizData.questions[currentQuestionIndex];
        const timeRemaining = Math.max(0, question.timeLimit - Math.floor((Date.now() - questionStartTime) / 1000));
        
        // Get current participant data
        const participantSnapshot = await database.ref(`participants/${gameCode}/${playerId}`).once('value');
        const participant = participantSnapshot.val();
        
        if (!participant) {
            alert('Participant not found');
            return;
        }
        
        // Check if already answered
        const answers = participant.answers || [];
        if (answers[currentQuestionIndex] !== undefined) {
            alert('You have already answered this question');
            return;
        }
        
        // Calculate if answer is correct
        const isCorrect = question.correctAnswerIndex === answerIndex;
        
        // Calculate score
        let score = 0;
        if (isCorrect) {
            const baseScore = 100;
            const timeBonus = Math.floor((timeRemaining / question.timeLimit) * 50);
            score = baseScore + timeBonus;
        }
        
        // Update answers array
        answers[currentQuestionIndex] = {
            answerIndex,
            isCorrect,
            timeRemaining,
            score
        };
        
        // Update participant data in Firebase
        await database.ref(`participants/${gameCode}/${playerId}`).update({
            answers,
            score: participant.score + score
        });
        
        // Show answer feedback
        showAnswerFeedback(isCorrect, score);
        
    } catch (error) {
        console.error('Error submitting answer:', error);
        alert('Failed to submit answer. Please try again.');
    }
}

// ===== CLEANUP FUNCTIONS =====

// Add these functions to clean up listeners when done
function cleanupFirebaseListeners() {
    const gameCode = localStorage.getItem('currentGameCode');
    if (!gameCode) return;
    
    // Remove all listeners for this game
    database.ref(`participants/${gameCode}`).off();
    database.ref(`quiz_status/${gameCode}`).off();
    database.ref(`quizzes/${gameCode}`).off();
}

// Call this when leaving a quiz
leaveQuizBtn.addEventListener('click', async () => {
    const gameCode = localStorage.getItem('currentGameCode');
    const playerId = localStorage.getItem('playerId');
    const isHost = localStorage.getItem('isHost') === 'true';
    
    if (gameCode && playerId && !isHost) {
        // Remove player from Firebase
        await database.ref(`participants/${gameCode}/${playerId}`).remove();
    }
    
    // Clean up listeners
    cleanupFirebaseListeners();
    
    // Clear local storage
    localStorage.removeItem('isHost');
    localStorage.removeItem('currentGameCode');
    localStorage.removeItem('playerId');
    
    // Show join form
    waitingRoom.classList.add('hidden');
    joinQuizForm.classList.remove('hidden');
    
    // Clear inputs
    joinGameCodeInput.value = '';
    playerNameInput.value = '';
});

// Call this when ending a quiz as host
endQuizBtn.addEventListener('click', async () => {
    const gameCode = localStorage.getItem('currentGameCode');
    
    if (gameCode) {
        // Update quiz status
        await database.ref(`quiz_status/${gameCode}`).update({
            started: false,
            quizOver: true
        });
        
        // Optionally, you can delete the quiz data after it's over
        // await database.ref(`quizzes/${gameCode}`).remove();
        // await database.ref(`participants/${gameCode}`).remove();
        // await database.ref(`quiz_status/${gameCode}`).remove();
    }
    
    // Clean up listeners
    cleanupFirebaseListeners();
    
    // Clear local storage
    localStorage.removeItem('isHost');
    localStorage.removeItem('currentGameCode');
    
    // Hide host interface
    document.getElementById('quiz-host-interface').classList.add('hidden');
    
    // Show home page
    document.getElementById('home').scrollIntoView({ behavior: 'smooth' });
});