// Firebase configuration
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

// Game state management
const gameState = {
    quizzes: {},
    participants: {},
    quizStatus: {}
};

// Function to generate a unique game code
function generateGameCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Function to create a new quiz
async function createQuiz(quizData) {
    const gameCode = generateGameCode();
    
    try {
        // Store quiz data in Firebase
        await database.ref(`quizzes/${gameCode}`).set(quizData);
        
        // Initialize participants list
        await database.ref(`participants/${gameCode}`).set({});
        
        // Initialize quiz status
        await database.ref(`quiz_status/${gameCode}`).set({
            started: false,
            currentQuestionIndex: 0,
            questionStartTime: null,
            questionResultsVisible: false
        });
        
        return gameCode;
    } catch (error) {
        console.error('Error creating quiz:', error);
        throw error;
    }
}

// Function to get quiz data
async function getQuiz(gameCode) {
    try {
        const snapshot = await database.ref(`quizzes/${gameCode}`).once('value');
        return snapshot.val();
    } catch (error) {
        console.error('Error getting quiz:', error);
        throw error;
    }
}

// Function to add a participant
async function addParticipant(gameCode, participant) {
    try {
        // Check if participant name already exists
        const participantsSnapshot = await database.ref(`participants/${gameCode}`).once('value');
        const participants = participantsSnapshot.val() || {};
        
        for (const key in participants) {
            if (participants[key].name === participant.name) {
                throw new Error('Participant name already exists');
            }
        }
        
        // Add new participant
        const newParticipantRef = database.ref(`participants/${gameCode}`).push();
        await newParticipantRef.set({
            id: newParticipantRef.key,
            name: participant.name,
            score: 0,
            answers: []
        });
        
        return newParticipantRef.key;
    } catch (error) {
        console.error('Error adding participant:', error);
        throw error;
    }
}

// Function to get participants
async function getParticipants(gameCode) {
    try {
        const snapshot = await database.ref(`participants/${gameCode}`).once('value');
        return snapshot.val() || {};
    } catch (error) {
        console.error('Error getting participants:', error);
        throw error;
    }
}

// Function to start a quiz
async function startQuiz(gameCode) {
    try {
        await database.ref(`quiz_status/${gameCode}`).update({
            started: true,
            currentQuestionIndex: 0,
            questionStartTime: Date.now(),
            questionResultsVisible: false
        });
    } catch (error) {
        console.error('Error starting quiz:', error);
        throw error;
    }
}

// Function to submit an answer
async function submitAnswer(gameCode, participantId, questionIndex, answerIndex, timeRemaining) {
    try {
        // Get quiz data
        const quizSnapshot = await database.ref(`quizzes/${gameCode}`).once('value');
        const quiz = quizSnapshot.val();
        
        if (!quiz || !quiz.questions || !quiz.questions[questionIndex]) {
            throw new Error('Invalid question');
        }
        
        const question = quiz.questions[questionIndex];
        const isCorrect = question.correctAnswerIndex === answerIndex;
        
        // Calculate score based on correctness and time remaining
        let score = 0;
        if (isCorrect) {
            const baseScore = 100;
            const timeBonus = Math.floor((timeRemaining / question.timeLimit) * 50);
            score = baseScore + timeBonus;
        }
        
        // Update participant's answer and score
        const participantRef = database.ref(`participants/${gameCode}/${participantId}`);
        
        // Get current participant data
        const participantSnapshot = await participantRef.once('value');
        const participant = participantSnapshot.val();
        
        if (!participant) {
            throw new Error('Participant not found');
        }
        
        // Update answers array
        const answers = participant.answers || [];
        answers[questionIndex] = {
            answerIndex,
            isCorrect,
            timeRemaining,
            score
        };
        
        // Update participant data
        await participantRef.update({
            answers,
            score: participant.score + score
        });
        
        return {
            isCorrect,
            score,
            totalScore: participant.score + score
        };
    } catch (error) {
        console.error('Error submitting answer:', error);
        throw error;
    }
}

// Function to get quiz status
async function getQuizStatus(gameCode) {
    try {
        const snapshot = await database.ref(`quiz_status/${gameCode}`).once('value');
        return snapshot.val() || {
            started: false,
            currentQuestionIndex: 0,
            questionStartTime: null,
            questionResultsVisible: false
        };
    } catch (error) {
        console.error('Error getting quiz status:', error);
        throw error;
    }
}

// Function to move to next question
async function nextQuestion(gameCode) {
    try {
        // Get current status
        const statusSnapshot = await database.ref(`quiz_status/${gameCode}`).once('value');
        const status = statusSnapshot.val() || {};
        
        // Get quiz data to check if there are more questions
        const quizSnapshot = await database.ref(`quizzes/${gameCode}`).once('value');
        const quiz = quizSnapshot.val();
        
        if (!quiz || !quiz.questions || status.currentQuestionIndex >= quiz.questions.length - 1) {
            // Quiz is over
            await database.ref(`quiz_status/${gameCode}`).update({
                started: false,
                quizOver: true
            });
            return false;
        }
        
        // Move to next question
        await database.ref(`quiz_status/${gameCode}`).update({
            currentQuestionIndex: status.currentQuestionIndex + 1,
            questionStartTime: Date.now(),
            questionResultsVisible: false
        });
        
        return true;
    } catch (error) {
        console.error('Error moving to next question:', error);
        throw error;
    }
}

// Function to show question results
async function showQuestionResults(gameCode) {
    try {
        await database.ref(`quiz_status/${gameCode}`).update({
            questionResultsVisible: true
        });
    } catch (error) {
        console.error('Error showing question results:', error);
        throw error;
    }
}

// Function to end quiz
async function endQuiz(gameCode) {
    try {
        await database.ref(`quiz_status/${gameCode}`).update({
            started: false,
            quizOver: true
        });
    } catch (error) {
        console.error('Error ending quiz:', error);
        throw error;
    }
}

// Function to clean up quiz data (call this when quiz is finished)
async function cleanupQuiz(gameCode) {
    try {
        await Promise.all([
            database.ref(`quizzes/${gameCode}`).remove(),
            database.ref(`participants/${gameCode}`).remove(),
            database.ref(`quiz_status/${gameCode}`).remove()
        ]);
    } catch (error) {
        console.error('Error cleaning up quiz:', error);
        throw error;
    }
}

// Real-time listeners
function setupQuizListener(gameCode, callback) {
    return database.ref(`quizzes/${gameCode}`).on('value', (snapshot) => {
        callback(snapshot.val());
    });
}

function setupParticipantsListener(gameCode, callback) {
    return database.ref(`participants/${gameCode}`).on('value', (snapshot) => {
        callback(snapshot.val() || {});
    });
}

function setupQuizStatusListener(gameCode, callback) {
    return database.ref(`quiz_status/${gameCode}`).on('value', (snapshot) => {
        callback(snapshot.val() || {});
    });
}

// Remove listeners
function removeListener(listener) {
    database.ref().off('value', listener);
}