const express = require('express');
const router = express.Router();

// Obtener todos los materiales (público)
router.get('/', (req, res) => {
    console.log('📚 Solicitando materiales del curso');
    
    // Materiales de ejemplo para probar
    const sampleMaterials = [
        {
            id: 1,
            title: "Introducción a la Informática Médica",
            description: "Conceptos básicos y fundamentos",
            category: "Teórico",
            uploaded_at: new Date().toISOString()
        },
        {
            id: 2,
            title: "Sistemas de Información Hospitalaria",
            description: "Análisis de sistemas HIS",
            category: "Práctico",
            uploaded_at: new Date().toISOString()
        }
    ];
    
    res.json(sampleMaterials);
});

module.exports = router;