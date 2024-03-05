const { Op } = require('sequelize');
const { Client, codeBlock, Collection, Events, GatewayIntentBits } = require('discord.js');
const { Users, CurrencyShop } = require('./dbObjects.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
const currency = new Collection();

async function addBalance(id, amount) {
	const user = currency.get(id);

	if (user) {
		user.balance += Number(amount);
		return user.save();
	}

	const newUser = await Users.create({ user_id: id, balance: amount });
	currency.set(id, newUser);

	return newUser;
}

function getBalance(id) {
	const user = currency.get(id);
	return user ? user.balance : 0;
}

client.once(Events.ClientReady, async readyClient => {
	const storedBalances = await Users.findAll();
	storedBalances.forEach(b => currency.set(b.user_id, b));

	console.log(`Logged in as ${readyClient.user.tag}!`);
});

client.once(Events.ClientReady, readyClient => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const { commandName } = interaction;

	if (commandName === 'balance') {
		const target = interaction.options.getUser('user') ?? interaction.user;

		return interaction.reply(`${target.tag} has ${getBalance(target.id)}💰`);
	}

	else if (commandName === 'inventory') {
		const target = interaction.options.getUser('user') ?? interaction.user;
		const user = await Users.findOne({ where: { user_id: target.id } });
		const items = await user.getItems();
	
		if (!items.length) return interaction.reply(`${target.tag} has nothing!`);
	
		return interaction.reply(`${target.tag} currently has ${items.map(i => `${i.amount} ${i.item.name}`).join(', ')}`);
	}

	else if (commandName === 'transfer') {
		const currentAmount = getBalance(interaction.user.id);
		const transferAmount = interaction.options.getInteger('amount');
		const transferTarget = interaction.options.getUser('user');
	
		if (transferAmount > currentAmount) return interaction.reply(`Sorry ${interaction.user}, you only have ${currentAmount}.`);
		if (transferAmount <= 0) return interaction.reply(`Please enter an amount greater than zero, ${interaction.user}.`);
	
		addBalance(interaction.user.id, -transferAmount);
		addBalance(transferTarget.id, transferAmount);
	
		return interaction.reply(`Successfully transferred ${transferAmount}💰 to ${transferTarget.tag}. Your current balance is ${getBalance(interaction.user.id)}💰`);
	}

	else if (commandName === 'buy') {
		const itemName = interaction.options.getString('item');
		const item = await CurrencyShop.findOne({ where: { name: { [Op.like]: itemName } } });
	
		if (!item) return interaction.reply(`That item doesn't exist.`);
		if (item.cost > getBalance(interaction.user.id)) {
			return interaction.reply(`You currently have ${getBalance(interaction.user.id)}, but the ${item.name} costs ${item.cost}!`);
		}
	
		const user = await Users.findOne({ where: { user_id: interaction.user.id } });
		addBalance(interaction.user.id, -item.cost);
		await user.addItem(item);
	
		return interaction.reply(`You've bought: ${item.name}.`);
	}

	else if (commandName === 'shop') {
		const items = await CurrencyShop.findAll();
		return interaction.reply(codeBlock(items.map(i => `${i.name}: ${i.cost}💰`).join('\n')));
	}
});

client.login('MTIxNDI1MjQ2OTUzODkyMjU5Ng.G8jNmK.fZ0dnAtuB8NFA2NGgCfoEqpG1ME4Tbe4Qc2uL8');