const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const { createCanvas } = require('canvas');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dictionary')
        .setDescription('Search for a word in the dictionary')
        .addStringOption(option =>
            option.setName('word')
                .setDescription('The word to search for')
                .setRequired(true)),
    async execute(interaction) {
        const word = interaction.options.getString('word');
        let fetchedWord = word;
        let phonetic = '';
        let partOfSpeech = '';
        let definition = '';
        
        try {
            const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
            const data = response.data;
            if (data.length > 0) {
                const entry = data[0];
                fetchedWord = entry.word || word;
                
                // Get phonetic: try entry.phonetic then first available from entry.phonetics
                if (entry.phonetic) {
                    phonetic = entry.phonetic;
                } else if (entry.phonetics && entry.phonetics.length > 0) {
                    phonetic = entry.phonetics.find(p => p.text)?.text || '';
                }
                
                // Replace all forward slashes with vertical bars in the phonetic.
                if (phonetic) {
                    phonetic = phonetic.replace(/\//g, ' | ');
                }
                
                // Prepare an array of definitions: use the first meaning for the first def,
                // and if a second meaning exists, use its first def.
                let definitions = [];
                if (entry.meanings && entry.meanings.length > 0) {
                    const meaningEntry0 = entry.meanings[0];
                    partOfSpeech = meaningEntry0.partOfSpeech || '';
                    if (meaningEntry0.definitions && meaningEntry0.definitions.length > 0) {
                        definitions.push(meaningEntry0.definitions[0].definition || '');
                    }
                    if (entry.meanings.length > 1) {
                        const meaningEntry1 = entry.meanings[1];
                        if (meaningEntry1.definitions && meaningEntry1.definitions.length > 0) {
                            definitions.push(`(${meaningEntry1.partOfSpeech || ''}) ${meaningEntry1.definitions[0].definition || ''}`);
                        }
                    }
                }
                
                // Use 2 definitions if available; otherwise, only one.
                const numDefs = definitions.length > 1 ? 2 : 1;
                const definitionsToShow = definitions.slice(0, numDefs);
                if (definitionsToShow.length > 1) {
                    definition = definitionsToShow
                        .map((def, index) => `${index + 1}. ${def}`)
                        .join('\n');
                } else if (definitionsToShow.length === 1) {
                    definition = definitionsToShow[0];
                }
            }
        } catch (error) {
            return interaction.reply(`Sorry, I couldn't find **${word}** in the dictionary.`);
        }
        
        // Fixed width
        const width = 600;
        // Text settings
        const leftMargin = 20;
        const wordY = 50; // y for the main word
        const posY = wordY + 35; // y for part of speech
        const defStartY = posY + 35; // y where definition starts
        const defFont = '16px Libre Baskerville, serif';
        const lineHeight = 22;
        const maxTextWidth = width - (leftMargin * 2);
        
        // Create a temporary canvas for measuring definition text
        const tempCanvas = createCanvas(width, 100);
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.font = defFont;
        
        // Split the definition into paragraphs (each bullet is on its own line)
        const paragraphs = definition.split('\n');
        const defLines = [];
        
        // Process each paragraph separately
        for (let p = 0; p < paragraphs.length; p++) {
            const para = paragraphs[p].trim();
            if (!para) continue;
            const wordsArray = para.split(' ');
            let line = '';
            for (let i = 0; i < wordsArray.length; i++) {
                const testLine = line + wordsArray[i] + ' ';
                const metrics = tempCtx.measureText(testLine);
                if (metrics.width > maxTextWidth && line !== '') {
                    defLines.push(line.trim());
                    line = wordsArray[i] + ' ';
                } else {
                    line = testLine;
                }
            }
            if (line) defLines.push(line.trim());
            // Add an extra blank line after each paragraph except the last one
            if (p < paragraphs.length - 1) {
                defLines.push('');
            }
        }
        
        // Calculate dynamic height: top section (defStartY) + definition lines + bottom margin (20)
        const finalHeight = defStartY + (defLines.length * lineHeight) + 20;
        
        // Use a scale factor to improve clarity
        const scale = 2;
        const canvas = createCanvas(width * scale, finalHeight * scale);
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        
        // Fill background with dark gray
        ctx.fillStyle = '#1D1D1E';
        ctx.fillRect(0, 0, width, finalHeight);
        
        // Draw the main word in large, bold, bright white Libre Baskerville font
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Libre Baskerville, serif';
        ctx.fillText(fetchedWord, leftMargin, wordY);
        
        // Draw phonetic next to the main word in color #999 if available
        if (phonetic) {
            const wordMetrics = ctx.measureText(fetchedWord);
            const phoneticX = leftMargin + wordMetrics.width + 10;
            ctx.fillStyle = '#999999';
            ctx.font = '16px Libre Baskerville, serif';
            ctx.fillText(phonetic, phoneticX, wordY - 5);
        }
        
        // Draw part of speech in slightly faded white
        ctx.font = '18px Libre Baskerville, serif';
        ctx.fillStyle = '#cccccc';
        if (partOfSpeech) {
            ctx.fillText(partOfSpeech, leftMargin, posY);
        }
        
        // Draw definition text, left aligned
        ctx.font = defFont;
        ctx.fillStyle = '#ffffff';
        let currentY = defStartY;
        defLines.forEach((line) => {
            ctx.fillText(line, leftMargin, currentY);
            currentY += lineHeight;
        });
        
        const buffer = canvas.toBuffer('image/png');
        return interaction.reply({ 
            content: `Dictionary entry for **${fetchedWord}**:`,
            files: [{ attachment: buffer, name: 'entry.png' }]
        });
    },
};