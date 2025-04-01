// --- Configuration ---
const GRID_SIZE: number = 4;
const MIN_WORD_LENGTH: number = 4;
const MAX_WORD_LENGTH: number = 8; // Added max length
const DICTIONARY_FILE: string = 'words.txt'; // Assumed to be in the same directory

// Define the 8 directions (including diagonals)
const DIRECTIONS: Array<[number, number]> = [
    [-1, -1], [-1, 0], [-1, 1],  // Up-Left, Up, Up-Right
    [ 0, -1],          [ 0, 1],  // Left, Right
    [ 1, -1], [ 1, 0], [ 1, 1]   // Down-Left, Down, Down-Right
];

// --- Global Variables ---
let wordSet = new Set<string>();
let prefixSet = new Set<string>();
let dictionaryLoaded = false;
let isLoading = false;

// --- DOM Elements ---
const gridContainer = document.getElementById('grid-container') as HTMLDivElement;
const solveButton = document.getElementById('solveButton') as HTMLButtonElement;
const resultsDiv = document.getElementById('results') as HTMLDivElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;

// --- Helper Functions ---

function updateStatus(message: string, type: 'loading' | 'error' | 'success' | 'info' = 'info') {
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type}`; // Reset classes and add current type
}

function isValid(row: number, col: number): boolean {
    return row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE;
}

async function loadDictionary(): Promise<boolean> {
    if (dictionaryLoaded) return true;
    if (isLoading) return false; // Prevent multiple loads

    isLoading = true;
    updateStatus('Loading dictionary...', 'loading');
    solveButton.disabled = true;
    console.log(`Attempting to load dictionary from: ${DICTIONARY_FILE}`);

    try {
        const response = await fetch(DICTIONARY_FILE);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - Could not fetch ${DICTIONARY_FILE}`);
        }
        const text = await response.text();
        const words = text.split(/\r?\n/); // Split by lines, handling different line endings

        wordSet = new Set<string>();
        prefixSet = new Set<string>();
        let loadedWordCount = 0;
        let prefixCount = 0;

        words.forEach(word => {
            const cleanedWord = word.trim().toLowerCase();
            // Filter words based on game rules/potential validity
            if (cleanedWord.length >= MIN_WORD_LENGTH && cleanedWord.length <= MAX_WORD_LENGTH && /^[a-z]+$/.test(cleanedWord)) {
                wordSet.add(cleanedWord);
                loadedWordCount++;
                 // Add prefixes only for potentially valid words
                for (let i = 1; i <= cleanedWord.length; i++) {
                    const prefix = cleanedWord.substring(0, i);
                     if (!prefixSet.has(prefix)) {
                        prefixSet.add(prefix);
                        prefixCount++;
                    }
                }
            }
            // Also add shorter prefixes from longer words (important for pruning)
            else if (cleanedWord.length > MAX_WORD_LENGTH && /^[a-z]+$/.test(cleanedWord)) {
                for (let i = 1; i <= MAX_WORD_LENGTH; i++) {
                    const prefix = cleanedWord.substring(0, i);
                    if (!prefixSet.has(prefix)) {
                       prefixSet.add(prefix);
                       prefixCount++;
                   }
                }
            }
             // Add single/short letter prefixes too
             else if (cleanedWord.length > 0 && cleanedWord.length < MIN_WORD_LENGTH && /^[a-z]+$/.test(cleanedWord)) {
                 for (let i = 1; i <= cleanedWord.length; i++) {
                     const prefix = cleanedWord.substring(0, i);
                      if (!prefixSet.has(prefix)) {
                         prefixSet.add(prefix);
                         prefixCount++;
                     }
                 }
             }
        });

        if (wordSet.size === 0) {
             console.warn(`Loaded dictionary, but found 0 words between length ${MIN_WORD_LENGTH} and ${MAX_WORD_LENGTH}. Check ${DICTIONARY_FILE}.`);
             updateStatus(`Dictionary loaded, but no valid words found (length ${MIN_WORD_LENGTH}-${MAX_WORD_LENGTH}). Check format.`, 'error');
        } else {
            console.log(`Dictionary loaded: ${loadedWordCount} valid words (length ${MIN_WORD_LENGTH}-${MAX_WORD_LENGTH}), ${prefixCount} prefixes generated.`);
            updateStatus('Dictionary loaded successfully.', 'success');
            dictionaryLoaded = true;
        }
        return true;

    } catch (error) {
        console.error('Error loading dictionary:', error);
        updateStatus(`Error loading dictionary: ${error instanceof Error ? error.message : String(error)}. Ensure 'words.txt' exists and is accessible.`, 'error');
        dictionaryLoaded = false;
        return false;
    } finally {
        isLoading = false;
        // Re-enable button only if dictionary loaded successfully
        solveButton.disabled = !dictionaryLoaded;
    }
}

function getGridLetters(): string[][] | null {
    const grid: string[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(''));
    const inputs = gridContainer.querySelectorAll('.grid-input') as NodeListOf<HTMLInputElement>;
    const letters: string[] = [];

    if (inputs.length !== GRID_SIZE * GRID_SIZE) {
        console.error("Incorrect number of input fields found.");
        return null; // Should not happen if generateGridInputs works
    }

    inputs.forEach(input => {
        letters.push(input.value.trim().toLowerCase());
    });

    // Validate input
    if (letters.some(letter => letter.length !== 1 || !/^[a-z]$/.test(letter))) {
         updateStatus('Please fill all grid cells with single letters.', 'error');
         return null;
     }

    // Populate the 2D grid
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            grid[r][c] = letters[r * GRID_SIZE + c];
        }
    }
    return grid;
}


// --- Core DFS Search Function ---
function findWordsFromCell(
    startRow: number,
    startCol: number,
    grid: string[][],
): string[] {
    const foundWords = new Set<string>();
    // Stack stores: [row, col, currentWord, visitedSet as Set<string>]
    // VisitedSet stores "row,col" strings to mark visited cells in the *current* path
    const stack: Array<[number, number, string, Set<string>]> = [];

    const startChar = grid[startRow][startCol];

    // Optimization: Only start DFS if the first letter is a known prefix
    if (prefixSet.has(startChar)) {
         const initialVisited = new Set<string>();
         initialVisited.add(`${startRow},${startCol}`);
         stack.push([startRow, startCol, startChar, initialVisited]);
    }

    while (stack.length > 0) {
        const [row, col, currentWord, visited] = stack.pop()!; // Non-null assertion ok due to length check

        const currentLen = currentWord.length;

        // Check if the current path forms a valid word within length constraints
        if (currentLen >= MIN_WORD_LENGTH && currentLen <= MAX_WORD_LENGTH && wordSet.has(currentWord)) {
            foundWords.add(currentWord);
        }

        // Explore neighbors only if the word can still grow within MAX_WORD_LENGTH
        if (currentLen < MAX_WORD_LENGTH) {
             for (const [dr, dc] of DIRECTIONS) {
                 const nextRow = row + dr;
                 const nextCol = col + dc;
                 const nextPosString = `${nextRow},${nextCol}`;

                 // Check if the neighbor is valid and not already visited in this path
                 if (isValid(nextRow, nextCol) && !visited.has(nextPosString)) {
                     const nextChar = grid[nextRow][nextCol];
                     const nextWord = currentWord + nextChar;

                     // --- Crucial Pruning Step ---
                     // Only continue if the new word forms a valid prefix
                     if (prefixSet.has(nextWord)) {
                         const newVisited = new Set(visited); // Clone the visited set for the new path
                         newVisited.add(nextPosString);
                         stack.push([nextRow, nextCol, nextWord, newVisited]);
                     }
                 }
             }
        }
    }

    return Array.from(foundWords).sort(); // Return sorted list
}

// --- Main Solver Function ---
function solve() {
    if (!dictionaryLoaded) {
        updateStatus('Dictionary not loaded. Please wait or check errors.', 'error');
        // Optionally, trigger dictionary load again here:
        // loadDictionary().then(loaded => { if(loaded) solve(); });
        return;
    }
     if (isLoading) {
         updateStatus('Dictionary is currently loading...', 'loading');
         return;
     }

    const grid = getGridLetters();
    if (!grid) {
        // Error message already shown by getGridLetters
        return;
    }

    updateStatus('Searching for words...', 'loading');
    solveButton.disabled = true; // Disable button during search
    resultsDiv.innerHTML = ''; // Clear previous results

    // Use setTimeout to allow the UI to update ("Searching...") before blocking
    setTimeout(() => {
        const allFoundWords = new Map<string, string[]>(); // Key: "row,col", Value: words[]
        let uniqueWords = new Set<string>();
        let totalInstances = 0;

        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const words = findWordsFromCell(r, c, grid);
                if (words.length > 0) {
                    const key = `${r},${c}`;
                    allFoundWords.set(key, words);
                    words.forEach(word => uniqueWords.add(word));
                    totalInstances += words.length;
                }
            }
        }

        // --- Display Results ---
        if (allFoundWords.size === 0) {
            resultsDiv.textContent = 'No words found.';
        } else {
            let htmlResult = `<p>Found ${uniqueWords.size} unique word(s) (${totalInstances} instances total):</p>`;
             // Sort results by starting position for consistency
             const sortedKeys = Array.from(allFoundWords.keys()).sort();

             sortedKeys.forEach(key => {
                 const [r, c] = key.split(',').map(Number);
                 const startChar = grid[r][c].toUpperCase();
                 const words = allFoundWords.get(key);
                 htmlResult += `<p><span>Start (${r},${c}) '${startChar}':</span> ${words?.join(', ')}</p>`;
             });
            resultsDiv.innerHTML = htmlResult;
        }

        updateStatus(`Search complete. Found ${uniqueWords.size} unique words.`, 'success');
        solveButton.disabled = false; // Re-enable button
    }, 50); // Small delay (50ms)
}

// --- Generate Grid Inputs Dynamically ---
function generateGridInputs() {
     gridContainer.innerHTML = ''; // Clear existing inputs if any
     for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
         const input = document.createElement('input');
         input.type = 'text';
         input.maxLength = 1;
         input.classList.add('grid-input');
         input.id = `cell-${Math.floor(i / GRID_SIZE)}-${i % GRID_SIZE}`; // e.g., cell-0-0
         input.setAttribute('aria-label', `Grid cell row ${Math.floor(i / GRID_SIZE) + 1} column ${i % GRID_SIZE + 1}`);
          // Automatically move focus to the next input
         input.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            target.value = target.value.toUpperCase().replace(/[^A-Z]/g, ''); // Allow only letters, force uppercase visually
             if (target.value.length === 1) {
                 const nextInput = target.nextElementSibling as HTMLInputElement;
                 if (nextInput && nextInput.tagName === 'INPUT') {
                     nextInput.focus();
                     nextInput.select(); // Select text in next input for easy overwrite
                 } else if (i === (GRID_SIZE * GRID_SIZE - 1)) {
                     // If it's the last input, maybe focus the button
                     solveButton.focus();
                 }
             }
         });
         // Basic keyboard navigation (optional but helpful)
         input.addEventListener('keydown', (e) => {
            let currentCellIndex = i;
             let nextCellIndex = -1;
             switch(e.key) {
                 case 'ArrowRight': if ((currentCellIndex + 1) % GRID_SIZE !== 0) nextCellIndex = currentCellIndex + 1; break;
                 case 'ArrowLeft': if (currentCellIndex % GRID_SIZE !== 0) nextCellIndex = currentCellIndex - 1; break;
                 case 'ArrowDown': if (currentCellIndex < GRID_SIZE * (GRID_SIZE - 1)) nextCellIndex = currentCellIndex + GRID_SIZE; break;
                 case 'ArrowUp': if (currentCellIndex >= GRID_SIZE) nextCellIndex = currentCellIndex - GRID_SIZE; break;
                 case 'Enter': solveButton.click(); e.preventDefault(); break; // Trigger solve on Enter
                 case 'Backspace':
                     // If input is empty, move to previous and clear it
                     if ((e.target as HTMLInputElement).value === '' && currentCellIndex > 0) {
                         const prevInput = gridContainer.children[currentCellIndex - 1] as HTMLInputElement;
                         prevInput.value = ''; // Clear previous
                         prevInput.focus();
                         e.preventDefault(); // Prevent default backspace behavior (like going back in browser history)
                     }
                     break;

             }
             if (nextCellIndex !== -1 && nextCellIndex < GRID_SIZE * GRID_SIZE) {
                 (gridContainer.children[nextCellIndex] as HTMLInputElement).focus();
                 e.preventDefault(); // Prevent default arrow key scrolling
             }
         });

         gridContainer.appendChild(input);
     }
 }

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    generateGridInputs();
    solveButton.addEventListener('click', solve);
    // Attempt to load dictionary immediately on page load
    loadDictionary();
});
