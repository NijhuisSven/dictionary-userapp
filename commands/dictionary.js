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
                .setRequired(true))
        .addStringOption(option =>
            option.setName('language')
                .setDescription('The language of the word')
                .setRequired(false)
                .addChoices(
                    { name: '🇺🇸 | English', value: 'en' },
                    { name: '🇪🇸 | Spanish', value: 'es' },
                    { name: '🇫🇷 | French', value: 'fr' },
                    { name: '🇩🇪 | German', value: 'de' },
                    { name: '🇳🇱 | Dutch', value: 'nl' },
                    { name: '🇨🇳 | Chinese', value: 'zh' },
                    { name: '🇮🇹 | Italian', value: 'it' },
                    { name: '🇯🇵 | Japanese', value: 'ja' },
                    { name: '🇰🇷 | Korean', value: 'ko' },
                    { name: '🇵🇹 | Portuguese', value: 'pt' },
                    { name: '🇷🇺 | Russian', value: 'ru' },
                    { name: '🇸🇪 | Swedish', value: 'sv' },
                    { name: '🇳🇴 | Norwegian', value: 'no' },
                    { name: '🇩🇰 | Danish', value: 'da' },
                    { name: '🇫🇮 | Finnish', value: 'fi' },
                    { name: '🇵🇱 | Polish', value: 'pl' },
                    { name: '🇭🇺 | Hungarian', value: 'hu' },
                    { name: '🇹🇷 | Turkish', value: 'tr' },
                    { name: '🇬🇷 | Greek', value: 'el' },
                    { name: '🇨🇿 | Czech', value: 'cs' },
                    { name: '🇭🇷 | Croatian', value: 'hr' },
                    { name: '🇷🇴 | Romanian', value: 'ro' }

                )),
    async execute(interaction) {
        const word = interaction.options.getString('word');
        const language = interaction.options.getString('language') || 'en';
        let fetchedWord = word;
        let phonetic = '';
        let partOfSpeech = '';
        let definition = '';

        try {
            // The new API URL now returns a single object.
            const response = await axios.get(`http://api.nijhuissven.nl:3000/api/definition/${language}/${word}`);
            const data = response.data;
            if (data.status !== 1) {
                return interaction.reply(`Sorry, I couldn't find **${word}** in the dictionary.`);
            }
            // Extract values from the new API response.
            fetchedWord = data.word || word;
            phonetic = data.phonetic || '';
            partOfSpeech = data.partOfSpeech || '';
            definition = data.definition || 'No definition available.';
            if (phonetic) {
                phonetic = phonetic.replace(/\//g, ' | ');
            }
        } catch (error) {
            console.error(error);
            return interaction.reply(`Sorry, I couldn't find **${word}** in the dictionary.`);
        }
        
        // Canvas settings
        const width = 600;
        const leftMargin = 20;
        const wordY = 50;             // Header y-coordinate
        const posY = wordY + 35;        // partOfSpeech y-coordinate
        const defStartY = posY + 35;    // Start y-coordinate for definition text
        const defFont = '16px Libre Baskerville, serif';
        const lineHeight = 22;
        const maxTextWidth = width - (leftMargin * 2);
        
        // Wrap the definition text into lines.
        const tempCanvas = createCanvas(width, 100);
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.font = defFont;
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
        
        const finalHeight = defStartY + (defLines.length * lineHeight) + 20;
        const scale = 2;
        const canvas = createCanvas(width * scale, finalHeight * scale);
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        
        // Draw background.
        ctx.fillStyle = '#1D1D1E';
        ctx.fillRect(0, 0, width, finalHeight);
        
        // Draw header: the word in bold.
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Libre Baskerville, serif';
        ctx.fillText(fetchedWord, leftMargin, wordY);
        
        // Draw phonetic text next to header if available.
        if (phonetic) {
            const wordMetrics = ctx.measureText(fetchedWord);
            const phoneticX = leftMargin + wordMetrics.width + 10;
            ctx.fillStyle = '#999999';
            ctx.font = '16px Libre Baskerville, serif';
            ctx.fillText(phonetic, phoneticX, wordY - 5);
        }
        
        // Draw part of speech.
        ctx.font = '18px Libre Baskerville, serif';
        ctx.fillStyle = '#cccccc';
        if (partOfSpeech) {
            ctx.fillText(partOfSpeech, leftMargin, posY);
        }
        
        // Draw the wrapped definition text.
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