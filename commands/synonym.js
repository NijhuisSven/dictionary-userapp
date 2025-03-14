const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const { createCanvas } = require('canvas');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('synonym')
        .setDescription('Find synonyms for a word')
        .addStringOption(option =>
            option.setName('word')
                .setDescription('Word to find synonyms for')
                .setRequired(true))
        .addNumberOption(option =>
            option.setName('amount')
                .setDescription('How many synonyms to return')
                .setRequired(false)),
    async execute(interaction) {
        const word = interaction.options.getString('word');
        let amount = interaction.options.getNumber('amount') || 1;
        if (amount > 10) { 
            amount = 10; 
        }
        
        let synonymsText = '';
        try {
            const response = await axios.get(`https://api.datamuse.com/words?rel_syn=${word}`);
            const data = response.data;
            // Take the top "amount" synonyms.
            const selectedSynonyms = data.slice(0, amount);
            if (selectedSynonyms.length === 0) {
                return interaction.reply(`Sorry, I couldn't find any synonyms for **${word}**.`);
            }
            // Create an array where each element is a numbered synonym.
            const entries = selectedSynonyms.map((r, index) => `${index + 1}. ${r.word}`);
            // Group the entries into two columns.
            const half = Math.ceil(entries.length / 2);
            const col1 = entries.slice(0, half);
            const col2 = entries.slice(half);
            // Join each column with newline.
            const col1Text = col1.join('\n');
            const col2Text = col2.join('\n');
            synonymsText = { col1Text, col2Text, maxLines: Math.max(col1.length, col2.length) };
        } catch (error) {
            console.error(error);
            return interaction.reply(`Sorry, I couldn't find any synonyms for **${word}**.`);
        }
        
        // Prepare the text to be rendered.
        // Header displays the given word in bold and next to it the word "Synonyms"
        
        // Canvas settings
        const width = 600;
        const leftMargin = 20;
        const wordY = 50;                     // Y-coordinate for header text
        const defStartY = wordY + 50;           // Spacing between header and columns
        const defFont = '16px Libre Baskerville, serif';
        const lineHeight = 25;                // Spacing between each line
        
        // Calculate available width and derive column width and gap.
        // Let effectiveWidth = width - leftMargin * 2.
        // Layout: colWidth + gapBetweenCols + colWidth = effectiveWidth.
        // Here, we set gapBetweenCols = 20% of colWidth, so 2.2 * colWidth = effectiveWidth.
        const effectiveWidth = width - (leftMargin * 2);
        const colWidth = effectiveWidth / 3;
        const gapBetweenCols = colWidth * 0.0001;
        
        // Create an off-screen canvas for measuring text (assuming synonyms are short and need no wrapping).
        const tempCanvas = createCanvas(width, 100);
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.font = defFont;
        
        // Calculate dynamic canvas height based on the maximum column lines.
        const finalHeight = defStartY + (synonymsText.maxLines * lineHeight) + 20;
        
        // Create the final canvas with scaling for clarity.
        const scale = 2;
        const canvas = createCanvas(width * scale, finalHeight * scale);
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        
        // Draw the background.
        ctx.fillStyle = '#1D1D1E';
        ctx.fillRect(0, 0, width, finalHeight);
        
        // Draw the header text: the given word in bold.
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Libre Baskerville, serif';
        ctx.fillText(word, leftMargin, wordY);
        
        // Draw "Synonyms" next to the header.
        const wordMetrics = ctx.measureText(word);
        const synonymsX = leftMargin + wordMetrics.width + 10;
        ctx.fillStyle = '#999999';
        ctx.font = '16px Libre Baskerville, serif';
        ctx.fillText('Synonyms', synonymsX, wordY - 5);
        
        // Draw the two columns of synonyms.
        ctx.font = defFont;
        ctx.fillStyle = '#ffffff';
        
        // First column x-coordinate.
        const col1X = leftMargin;
        // Second column x-coordinate.
        const col2X = leftMargin + colWidth + gapBetweenCols;
        
        // Split each column text into lines.
        const col1Lines = synonymsText.col1Text.split('\n');
        const col2Lines = synonymsText.col2Text.split('\n');
        
        let currentY = defStartY;
        col1Lines.forEach(line => {
            ctx.fillText(line, col1X, currentY);
            currentY += lineHeight;
        });
        // Reset y-coordinate for the second column.
        currentY = defStartY;
        col2Lines.forEach(line => {
            ctx.fillText(line, col2X, currentY);
            currentY += lineHeight;
        });
        
        const buffer = canvas.toBuffer('image/png');
        return interaction.reply({ 
            content: `Here are some synonyms for **${word}**:`,
            files: [{ attachment: buffer, name: 'synonyms.png' }]
        });
    },
};