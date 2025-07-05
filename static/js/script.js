let extractedText = '';
let batchResults = [];

// Single file upload handlers
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const extractBtn = document.getElementById('extractBtn');

// Batch upload handlers
const batchUploadArea = document.getElementById('batchUploadArea');
const batchFileInput = document.getElementById('batchFileInput');
const batchExtractBtn = document.getElementById('batchExtractBtn');

// Initialize event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Upload area click handlers
    uploadArea.addEventListener('click', () => fileInput.click());
    batchUploadArea.addEventListener('click', () => batchFileInput.click());

    // File input change handlers
    fileInput.addEventListener('change', handleFileSelect);
    batchFileInput.addEventListener('change', handleBatchFileSelect);

    // Drag and drop handlers
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);

    // Health check on page load
    checkServiceHealth();
});

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        displayFileInfo(file);
        extractBtn.disabled = false;
    }
}

function handleBatchFileSelect(event) {
    const files = event.target.files;
    if (files.length > 0) {
        batchExtractBtn.disabled = false;
        showSuccess(`${files.length} files selected for batch processing`);
    }
}

function displayFileInfo(file) {
    fileName.textContent = file.name;
    fileInfo.style.display = 'block';
}

function handleDragOver(event) {
    event.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(event) {
    event.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleDrop(event) {
    event.preventDefault();
    uploadArea.classList.remove('dragover');

    const files = event.dataTransfer.files;
    if (files.length > 0) {
        fileInput.files = files;
        displayFileInfo(files[0]);
        extractBtn.disabled = false;
    }
}

async function extractText() {
    const file = fileInput.files[0];
    if (!file) {
        showError('Please select a file first');
        return;
    }

    showLoading();
    hideMessages();

    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch('/extract-text', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            extractedText = result.text;
            displayResult(extractedText);
            showSuccess('Text extracted successfully!');
        } else {
            showError(result.error || 'Failed to extract text');
        }
    } catch (error) {
        showError('Network error: ' + error.message);
    } finally {
        hideLoading();
    }
}

async function extractBatchText() {
    const files = batchFileInput.files;
    if (files.length === 0) {
        showError('Please select files for batch processing');
        return;
    }

    showLoading();
    hideMessages();

    const formData = new FormData();
    for (let file of files) {
        formData.append('images', file);
    }

    try {
        const response = await fetch('/extract-text-batch', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            batchResults = result.results;
            displayBatchResults(batchResults);
            showSuccess(`Processed ${result.total_processed} files successfully!`);
        } else {
            showError(result.error || 'Failed to process batch');
        }
    } catch (error) {
        showError('Network error: ' + error.message);
    } finally {
        hideLoading();
    }
}

function displayResult(text) {
    const resultBox = document.getElementById('resultBox');
    const resultSection = document.getElementById('resultSection');

    if (text.trim()) {
        resultBox.textContent = text;
        resultBox.classList.remove('result-empty');
    } else {
        resultBox.innerHTML = '<div class="result-empty">No text found in the image</div>';
    }

    resultSection.style.display = 'block';
}

function displayBatchResults(results) {
    const batchResultsDiv = document.getElementById('batchResults');
    batchResultsDiv.innerHTML = '';

    results.forEach((result, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'batch-item';

        if (result.success) {
            itemDiv.innerHTML = `
                <h4>${result.filename}</h4>
                <div class="batch-text">${result.text || 'No text found'}</div>
            `;
        } else {
            itemDiv.innerHTML = `
                <h4>${result.filename} (Error)</h4>
                <div style="color: #721c24;">${result.error}</div>
            `;
        }

        batchResultsDiv.appendChild(itemDiv);
    });

    batchResultsDiv.style.display = 'block';
}

function copyToClipboard() {
    if (extractedText) {
        navigator.clipboard.writeText(extractedText).then(() => {
            showSuccess('Text copied to clipboard!');
        }).catch(() => {
            showError('Failed to copy text');
        });
    }
}

function downloadText() {
    if (extractedText) {
        const blob = new Blob([extractedText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'extracted-text.txt';
        a.click();
        URL.revokeObjectURL(url);
        showSuccess('Text downloaded successfully!');
    }
}

function clearAll() {
    fileInput.value = '';
    batchFileInput.value = '';
    extractedText = '';
    batchResults = [];

    fileInfo.style.display = 'none';
    document.getElementById('resultSection').style.display = 'none';
    document.getElementById('batchResults').style.display = 'none';

    extractBtn.disabled = true;
    batchExtractBtn.disabled = true;

    hideMessages();
    showSuccess('All data cleared');
}

function showLoading() {
    document.getElementById('loading').style.display = 'block';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    autoHideMessage(errorDiv);
}

function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    autoHideMessage(successDiv);
}

function hideMessages() {
    document.getElementById('errorMessage').style.display = 'none';
    document.getElementById('successMessage').style.display = 'none';
}

// Auto-hide messages after 5 seconds
function autoHideMessage(element) {
    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

// Health check on page load
async function checkServiceHealth() {
    try {
        const response = await fetch('/health');
        const result = await response.json();
        if (result.status === 'healthy') {
            console.log('✅ OCR service is running');
        }
    } catch (error) {
        console.error('❌ OCR service check failed:', error);
    }
}