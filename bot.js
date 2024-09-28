const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const { token, clientId } = require('./config.json');
const fs = require('fs');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const commands = [
    {
        name: 'ping',
        description: 'Replies with Pong!'
    },
    {
        name: 'hello',
        description: 'Replies with Hello, World!'
    },
    {
        name: 'quote',
        description: 'Sends a random quote.'
    }
];

let quotes = [];
fs.readFile('./stuff/quotes.json', 'utf8', (err, data) => {
    if (err) {
        console.error(err);
        return;
    }
    quotes = JSON.parse(data).quotes;
    console.log('Quotes loaded:', quotes);
});

// REST API to register commands
const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        // Register commands for a specific guild (for testing)
        await rest.put(
            Routes.applicationCommands(clientId),  // This registers commands globally
            { body: commands }
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);

    client.user.setPresence({
        activities: [{ name: '\u2B50' }],
        status: 'idle'
    }) .then(() => console.log('Custom status set successfully!')) .catch(console.error);


    console.log('TOUEEEE CARALHOOOOO');
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    // 

    const { commandName } = interaction;

    if (commandName === 'ping') {
        await interaction.reply('Pong!');
    } else if (commandName === 'hello') {
        await interaction.reply('Hello, World!');
    } else if (commandName === 'quote') {
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        const chance = 0.5; // Adjust this value as needed

        // If the random number is less than chance, send a special message
        if (Math.random() < chance) {
            await interaction.reply(`Here's a quote: "${randomQuote}" (Toue?)`);
        } else {
            await interaction.reply(`Here's a quote: "${randomQuote}"`);
        }
    }
});


client.login(token);
