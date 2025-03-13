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
                
                // Get phonetic – using entry.phonetic or the first available phonetics.text
                if (entry.phonetic) {
                    phonetic = entry.phonetic;
                } else if (entry.phonetics && entry.phonetics.length > 0) {
                    phonetic = entry.phonetics.find(p => p.text)?.text || '';
                }
                if (phonetic) phonetic = phonetic.replace(/\//g, ' | ');

                // Prepare up to two definitions (from first and second meanings)
                let definitions = [];
                if (entry.meanings && entry.meanings.length > 0) {
                    const firstMeaning = entry.meanings[0];
                    partOfSpeech = firstMeaning.partOfSpeech || '';
                    if (firstMeaning.definitions && firstMeaning.definitions.length > 0) {
                        definitions.push(firstMeaning.definitions[0].definition || '');
                    }
                    if (entry.meanings.length > 1) {
                        const secondMeaning = entry.meanings[1];
                        if (secondMeaning.definitions && secondMeaning.definitions.length > 0) {
                            definitions.push(`(${secondMeaning.partOfSpeech || ''}) ${secondMeaning.definitions[0].definition || ''}`);
                        }
                    }
                }
                // Use two definitions if available; otherwise, just one.
                const definitionsToShow = definitions.slice(0, definitions.length > 1 ? 2 : 1);
                definition = definitionsToShow.length > 1
                    ? definitionsToShow.map((def, idx) => `${idx + 1}. ${def}`).join('\n')
                    : definitionsToShow[0];
            }
        } catch (error) {
            return interaction.reply(`Sorry, I couldn't find **${word}** in the dictionary.`);
        }
        
        // Fixed image width and text settings
        const width = 600;
        const leftMargin = 20;
        const wordY = 50;
        const posY = wordY + 35;
        const defStartY = posY + 35;
        const defFont = '16px Libre Baskerville, serif';
        const lineHeight = 22;
        const maxTextWidth = width - (leftMargin * 2);
        
        // Create an off-screen canvas to measure text
        const tempCanvas = createCanvas(width, 100);
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.font = defFont;
        
        // Split definition into paragraphs and then wrap each paragraph into lines
        const paragraphs = definition.split('\n');
        const defLines = [];
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
            if (p < paragraphs.length - 1) {
                defLines.push('');
            }
        }
        
        // Calculate dynamic canvas height based on wrapped lines
        const finalHeight = defStartY + (defLines.length * lineHeight) + 20;
        
        // Create final canvas with scaling for clarity
        const scale = 2;
        const canvas = createCanvas(width * scale, finalHeight * scale);
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        
        // Draw background and main text elements
        ctx.fillStyle = '#1D1D1E';
        ctx.fillRect(0, 0, width, finalHeight);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Libre Baskerville, serif';
        ctx.fillText(fetchedWord, leftMargin, wordY);
        
        if (phonetic) {
            const wordMetrics = ctx.measureText(fetchedWord);
            const phoneticX = leftMargin + wordMetrics.width + 10;
            ctx.fillStyle = '#999999';
            ctx.font = '16px Libre Baskerville, serif';
            ctx.fillText(phonetic, phoneticX, wordY - 5);
        }
        
        ctx.font = '18px Libre Baskerville, serif';
        ctx.fillStyle = '#cccccc';
        if (partOfSpeech) {
            ctx.fillText(partOfSpeech, leftMargin, posY);
        }
        
        ctx.font = defFont;
        ctx.fillStyle = '#ffffff';
        let currentY = defStartY;
        defLines.forEach(line => {
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