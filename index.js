const fs = require('node:fs');
const path = require('node:path');
const { 
    Client, 
    Collection, 
    Events, 
    GatewayIntentBits, 
    REST, 
    Routes 
} = require('discord.js');
const { token } = require('./config.json');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Create a collection to store commands
client.commands = new Collection();

// --------------------
// Load Command Files
// --------------------
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// ---------------------
// Load Event Files
// ---------------------
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

// Create a REST instance for registering commands
const rest = new REST({ version: '10' }).setToken(token);

client.once(Events.ClientReady, async readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);

    // Register global slash commands
    try {
        await readyClient.application.commands.set(client.commands.map(command => command.data.toJSON()));
        console.log(`Successfully registered global application commands: ${client.commands.map(command => command.data.name).join(', ')}`);
    } catch (error) {
        console.error('Error registering global application commands:', error);
    }

    // Also register each command as a user-install command so they're available in DMs.
    // integration_types: [0, 1] makes the command available for both guilds and DMs,
    // contexts: [0, 1, 2] makes it available as a message, user or slash command.
    for (const command of client.commands.values()) {
        const userCommandData = { 
            ...command.data.toJSON(), 
            integration_types: [0, 1], 
            contexts: [0, 1, 2] 
        };
        try {
            await rest.post(Routes.applicationCommands(readyClient.user.id), { body: userCommandData });
            console.log(`Successfully registered user-install command: ${command.data.name}`);
        } catch (error) {
            console.error(`Error registering user-install command (${command.data.name}):`, error);
        }
    }
});

// Listen for interactions (slash commands and user commands)
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand() && !interaction.isMessageContextMenuCommand()) return;
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error executing that command!', ephemeral: true });
    }
});

client.login(token);