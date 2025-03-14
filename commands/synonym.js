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
        if (amount > 10) amount = 10;
        
        let synonymsText;
        try {
            const response = await axios.get(`https://api.datamuse.com/words?rel_syn=${word}`);
            const data = response.data;
            const selectedSynonyms = data.slice(0, amount);
            if (!selectedSynonyms.length) {
                return interaction.reply(`Sorry, I couldn't find any synonyms for **${word}**.`);
            }
            // Create numbered entries and split them into two columns.
            const entries = selectedSynonyms.map((r, i) => `${i + 1}. ${r.word}`);
            const mid = Math.ceil(entries.length / 2);
            const col1 = entries.slice(0, mid).join('\n');
            const col2 = entries.slice(mid).join('\n');
            synonymsText = { col1Text: col1, col2Text: col2, maxLines: Math.max(mid, entries.length - mid) };
        } catch (error) {
            console.error(error);
            return interaction.reply(`Sorry, I couldn't find any synonyms for **${word}**.`);
        }
        
        // Canvas settings
        const width = 600;
        const leftMargin = 20;
        const headerY = 50;         // Header text y-coordinate
        const contentY = headerY + 50; // Starting y-coordinate for synonym columns
        const defFont = '16px Libre Baskerville, serif';
        const lineHeight = 25;
        
        // Calculate available width and define column widths and gap.
        const effectiveWidth = width - (leftMargin * 2);
        const colWidth = effectiveWidth / 3;         // Using 1/3 of effective width per column,
        const gapBetweenCols = colWidth * 0.2;         // gap is 20% of colWidth
        
        const finalHeight = contentY + (synonymsText.maxLines * lineHeight) + 20;
        const scale = 2;
        const canvas = createCanvas(width * scale, finalHeight * scale);
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        
        // Draw background.
        ctx.fillStyle = '#1D1D1E';
        ctx.fillRect(0, 0, width, finalHeight);
        
        // Draw header: the word and the label "Synonyms".
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Libre Baskerville, serif';
        ctx.fillText(word, leftMargin, headerY);
        
        const wordMetrics = ctx.measureText(word);
        ctx.fillStyle = '#999999';
        ctx.font = '16px Libre Baskerville, serif';
        ctx.fillText('Synonyms', leftMargin + wordMetrics.width + 10, headerY - 5);
        
        // Draw synonym columns.
        ctx.font = defFont;
        ctx.fillStyle = '#ffffff';
        const col1X = leftMargin;
        const col2X = leftMargin + colWidth + gapBetweenCols;
        
        // Render first column.
        let yPos = contentY;
        synonymsText.col1Text.split('\n').forEach(line => {
            ctx.fillText(line, col1X, yPos);
            yPos += lineHeight;
        });
        // Render second column.
        yPos = contentY;
        synonymsText.col2Text.split('\n').forEach(line => {
            ctx.fillText(line, col2X, yPos);
            yPos += lineHeight;
        });
        
        const buffer = canvas.toBuffer('image/png');
        return interaction.reply({ 
            content: `Here are some synonyms for **${word}**:`,
            files: [{ attachment: buffer, name: 'synonyms.png' }]
        });
    },
};