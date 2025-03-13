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
const { get } = require('node:http');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ===============================
// Load Commands
// ===============================
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.warn(`WARNING: Command at ${filePath} is missing "data" or "execute".`);
    }
}

// ===============================
// Load Events
// ===============================
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

// ===============================
// Register Commands via REST
// ===============================
const rest = new REST({ version: '10' }).setToken(token);

client.once(Events.ClientReady, async readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    
    // Register global slash commands.
    try {
        const globalCommands = client.commands.map(command => command.data.toJSON());
        await readyClient.application.commands.set(globalCommands);
        console.log(`Global commands registered: ${client.commands.map(cmd => cmd.data.name).join(', ')}`);
    } catch (error) {
        console.error('Error registering global commands:', error);
    }
    
    // Also register each command as a user-install command so they're available in DMs.
    // integration_types: [0, 1] makes it available for guilds and DMs.
    // contexts: [0, 1, 2] makes it available in various command contexts.
    for (const command of client.commands.values()) {
        const userCommandData = {
            ...command.data.toJSON(),
            integration_types: [0, 1],
            contexts: [0, 1, 2]
        };
        try {
            await rest.post(Routes.applicationCommands(readyClient.user.id), { body: userCommandData });
            console.log(`User-install command registered: ${command.data.name}`);
        } catch (error) {
            console.error(`Error registering user-install command (${command.data.name}):`, error);
        }
    }
});

// ===============================
// Blocked Users Handler
// ===============================
function getBlockedUsers() {
    const data = fs.readFileSync("blockedUsers.json", "utf8");
    return JSON.parse(data).blocked;
}
function isUserBlocked(userId) {
    return getBlockedUsers().includes(userId);
  }
// ===============================
// Interaction Handler
// ===============================
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand() && !interaction.isMessageContextMenuCommand()) return;

    console.log(getBlockedUsers());
    if (isUserBlocked(interaction.user.id)) {
        return await interaction.reply({ content: 'You are blocked from using this bot. \n Please contact ``svenns.`` on discord for more information.', ephemeral: true });
    }
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
        console.error(`Command not found: ${interaction.commandName}`);
        return;
    }
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`Error executing command (${interaction.commandName}):`, error);
        await interaction.reply({ content: 'There was an error executing that command!', ephemeral: true });
    }
});

client.login(token);