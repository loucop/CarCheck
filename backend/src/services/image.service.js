const fs = require('fs').promises;
const path = require('path');
const { IMAGE_CONFIG } = require('../utils/constants');

const imageService = {
    /**
     * Salvar imagem base64 em disco
     * @returns {string} - Caminho relativo da imagem
     */
    async saveBase64Image(base64String, veiculoId, checklistId) {
        try {
            // Validação básica
            if (!base64String || !base64String.startsWith('data:image/')) {
                throw new Error('String base64 inválida');
            }

            // Extrai tipo e dados
            const matches = base64String.match(/^data:image\/(\w+);base64,(.+)$/);
            if (!matches) {
                throw new Error('Formato base64 inválido');
            }

            const imageType = matches[1];
            const base64Data = matches[2];
            
            // Valida tamanho
            const buffer = Buffer.from(base64Data, 'base64');
            if (buffer.length > IMAGE_CONFIG.MAX_SIZE) {
                throw new Error(`Imagem excede o tamanho máximo de ${IMAGE_CONFIG.MAX_SIZE / 1024 / 1024}MB`);
            }

            // Cria diretório se não existir
            const uploadDir = path.join(process.cwd(), IMAGE_CONFIG.UPLOAD_DIR);
            await fs.mkdir(uploadDir, { recursive: true });

            // Nome único do arquivo
            const timestamp = Date.now();
            const filename = `avaria_${veiculoId}_${checklistId}_${timestamp}.${imageType}`;
            const filepath = path.join(uploadDir, filename);

            // Salva arquivo
            await fs.writeFile(filepath, buffer);

            // Retorna caminho relativo
            return `uploads/avarias/${filename}`;
            
        } catch (err) {
            console.error('[IMAGE SERVICE ERROR]', err.message);
            throw new Error('Erro ao salvar imagem: ' + err.message);
        }
    },

    /**
     * Deletar imagem do disco
     */
    async deleteImage(relativePath) {
        try {
            if (!relativePath) return;
            
            const fullPath = path.join(process.cwd(), 'public', relativePath);
            await fs.unlink(fullPath);
            
        } catch (err) {
            // Ignora erro se arquivo não existe
            if (err.code !== 'ENOENT') {
                console.error('[IMAGE DELETE ERROR]', err.message);
            }
        }
    }
};

module.exports = imageService;
