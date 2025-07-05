from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import pytesseract
from PIL import Image
import os
import tempfile
import logging
from werkzeug.utils import secure_filename

#pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff'}
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# Create upload directory if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Create static directories if they don't exist
os.makedirs('static/css', exist_ok=True)
os.makedirs('static/js', exist_ok=True)


def allowed_file(filename):
    return '.' in filename and \
        filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/health')
def health_check():
    return jsonify({'status': 'healthy', 'message': 'OCR service is running'})


@app.route('/extract-text', methods=['POST'])
def extract_text():
    try:
        # Check if file is present
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400

        file = request.files['image']

        # Check if file is selected
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        # Check file type
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Supported: PNG, JPG, JPEG, GIF, BMP, TIFF'}), 400

        # Process the image
        logger.info(f"Processing file: {file.filename}")

        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as tmp_file:
            file.save(tmp_file.name)

            try:
                # Open and process image
                image = Image.open(tmp_file.name)

                # Convert to RGB if necessary
                if image.mode != 'RGB':
                    image = image.convert('RGB')

                # Extract text using Tesseract
                custom_config = r'--oem 3 --psm 6'
                text = pytesseract.image_to_string(image, config=custom_config)

                # Clean up extracted text
                text = text.strip()

                logger.info(f"Successfully extracted text from {file.filename}")

                return jsonify({
                    'success': True,
                    'text': text,
                    'filename': secure_filename(file.filename),
                    'message': 'Text extracted successfully'
                })

            except Exception as e:
                logger.error(f"Error processing image: {str(e)}")
                return jsonify({'error': f'Error processing image: {str(e)}'}), 500

            finally:
                # Clean up temporary file
                try:
                    os.unlink(tmp_file.name)
                except:
                    pass

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return jsonify({'error': 'An unexpected error occurred'}), 500


@app.route('/extract-text-batch', methods=['POST'])
def extract_text_batch():
    try:
        files = request.files.getlist('images')

        if not files:
            return jsonify({'error': 'No files provided'}), 400

        results = []

        for file in files:
            if file.filename == '' or not allowed_file(file.filename):
                continue

            try:
                with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as tmp_file:
                    file.save(tmp_file.name)

                    image = Image.open(tmp_file.name)
                    if image.mode != 'RGB':
                        image = image.convert('RGB')

                    text = pytesseract.image_to_string(image)

                    results.append({
                        'filename': secure_filename(file.filename),
                        'text': text.strip(),
                        'success': True
                    })

                    os.unlink(tmp_file.name)

            except Exception as e:
                results.append({
                    'filename': secure_filename(file.filename),
                    'error': str(e),
                    'success': False
                })

        return jsonify({
            'success': True,
            'results': results,
            'total_processed': len(results)
        })

    except Exception as e:
        logger.error(f"Batch processing error: {str(e)}")
        return jsonify({'error': 'Batch processing failed'}), 500


@app.errorhandler(413)
def too_large(e):
    return jsonify({'error': 'File too large. Maximum size is 16MB'}), 413


@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(e):
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)