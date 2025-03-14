const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const { createCanvas } = require('canvas');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rhyme')
        .setDescription('Find rhymes for a word')
        .addStringOption(option =>
            option.setName('word')
                .setDescription('Word to rhyme with')
                .setRequired(true))
        .addNumberOption(option =>
            option.setName('amount')
                .setDescription('How many rhymes to return')
                .setRequired(false)),
    async execute(interaction) {
        const word = interaction.options.getString('word');
        let amount = interaction.options.getNumber('amount') || 1;
        if (amount > 10) amount = 10;
        
        let rhymesText;
        try {
            const response = await axios.get(`https://rhymebrain.com/talk?function=getRhymes&word=${word}`);
            const data = response.data;
            const selectedRhymes = data.slice(0, amount);
            if (selectedRhymes.length === 0) {
                return interaction.reply(`Sorry, I couldn't find any rhymes for **${word}**.`);
            }
            // Create an array where each element is a numbered rhyme.
            const entries = selectedRhymes.map((r, index) => `${index + 1}. ${r.word}`);
            const half = Math.ceil(entries.length / 2);
            const col1 = entries.slice(0, half);
            const col2 = entries.slice(half);
            const col1Text = col1.join('\n');
            const col2Text = col2.join('\n');
            rhymesText = {
                col1Text,
                col2Text,
                maxLines: Math.max(col1.length, col2.length)
            };
        } catch (error) {
            console.error(error);
            return interaction.reply(`Sorry, I couldn't find any rhymes for **${word}**.`);
        }
        
        // Canvas settings
        const width = 600;
        const leftMargin = 20;
        const wordY = 50; 
        const defStartY = wordY + 50;
        const defFont = '16px Libre Baskerville, serif';
        const lineHeight = 25;
        
        // Calculate available width and derive column width and gap.
        const effectiveWidth = width - leftMargin * 2;
        const gapBetweenCols = 5;
        const colWidth = (effectiveWidth - gapBetweenCols) / 3  ;
        
        const tempCanvas = createCanvas(width, 100);
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.font = defFont;
        
        const finalHeight = defStartY + (rhymesText.maxLines * lineHeight) + 20;
        
        const scale = 2;
        const canvas = createCanvas(width * scale, finalHeight * scale);
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        
        ctx.fillStyle = '#1D1D1E';
        ctx.fillRect(0, 0, width, finalHeight);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Libre Baskerville, serif';
        ctx.fillText(word, leftMargin, wordY);
        
        const wordMetrics = ctx.measureText(word);
        const rhymesX = leftMargin + wordMetrics.width + 10;
        ctx.fillStyle = '#999999';
        ctx.font = '16px Libre Baskerville, serif';
        ctx.fillText('Rhymes', rhymesX, wordY - 5);
        
        ctx.font = defFont;
        ctx.fillStyle = '#ffffff';
        
        const col1X = leftMargin;
        const col2X = leftMargin + colWidth + gapBetweenCols;
        
        const col1Lines = rhymesText.col1Text.split('\n');
        const col2Lines = rhymesText.col2Text.split('\n');
        
        let currentY = defStartY;
        col1Lines.forEach(line => {
            ctx.fillText(line, col1X, currentY);
            currentY += lineHeight;
        });
        
        currentY = defStartY;
        col2Lines.forEach(line => {
            ctx.fillText(line, col2X, currentY);
            currentY += lineHeight;
        });
        
        const buffer = canvas.toBuffer('image/png');
        return interaction.reply({
            content: `Here are some rhymes for **${word}**:`,
            files: [{ attachment: buffer, name: 'rhymes.png' }]
        });
    },
};