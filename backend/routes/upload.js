const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');

// Configurar multer para upload de imagens
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/produtos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'produto-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas!'), false);
    }
  }
});

// Rota para upload de imagem do produto
router.post('/produto/:id', authenticate, upload.single('imagem'), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Nenhuma imagem enviada'
      });
    }

    const imagem_url = `/uploads/produtos/${req.file.filename}`;
    
    // Atualizar produto com a URL da imagem
    const db = require('../config/database');
    db.run(
      'UPDATE produtos SET imagem_url = ? WHERE id = ?',
      [imagem_url, id],
      function(err) {
        if (err) {
          return res.status(500).json({
            success: false,
            error: 'Erro ao atualizar produto'
          });
        }

        res.json({
          success: true,
          message: 'Imagem uploadada com sucesso',
          imagem_url: imagem_url
        });
      }
    );

  } catch (error) {
    console.error('Erro no upload:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

module.exports = router;