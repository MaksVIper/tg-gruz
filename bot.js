const { Telegraf, session} = require("telegraf");
const Datastore = require('nedb');
const commandStart = require("./commands/shortCommands");
const {stageOne, stageFour, stageFive, stageSix, stageSeven, stageEight, calcShort, sendLead} = require("./actions/shortActions");
require('dotenv').config();
// Создать бота с полученным ключом
const bot = new Telegraf(process.env.TELEGRAM_TOKEN_EDU);
bot.use(session());
// Обработчик начала диалога с ботом
bot.start((ctx) => commandStart(ctx));
// Обработчик команды /help
bot.help((ctx) => ctx.reply("Справка в процессе"));

bot.action("stage_1", async (ctx) => {
    ctx.session = {
        formFields: {},
        state_step: 'costFull',
    };
    await stageOne(ctx);
});

bot.action(/^stage_2-(.*)$/, async (ctx) => {
    ctx.session = {
        ...ctx.session,
        valute: ctx.match[1],
    }
    await ctx.deleteMessage(ctx.session.message_id);
    await ctx.deleteMessage();
    const { message_id } =  await ctx.reply("Стоимость груза:");
    ctx.session = {
        ...ctx.session,
        message_id: message_id,
    }
});
bot.action(/^stage_5-(.*)$/, async (ctx) => {
    ctx.session = {
        ...ctx.session,
        transport: ctx.match[1],
    }
    await stageFive(ctx);
});

bot.action(/^stage_6-(.*)$/, async (ctx) => {
    ctx.session = {
        ...ctx.session,
        franchise: parseInt(ctx.match[1]),
    }
    await stageSix(ctx);
});

bot.action(/^stage_7-(.*)$/, async (ctx) => {
    ctx.session = {
        ...ctx.session,
        newCargo: parseInt(ctx.match[1]) !== 0,
    }
    await stageSeven(ctx);
});

bot.action(/^stage_8-(.*)$/, async (ctx) => {
    ctx.session = {
        ...ctx.session,
        upload: parseInt(ctx.match[1]) === 1,
    }
    await stageEight(ctx);
});
bot.action(/^calc_short-(.*)$/, async (ctx) => {
    ctx.session = {
        ...ctx.session,
        refrisks: parseInt(ctx.match[1]) === 1,
    }
    ctx.deleteMessage();
    await calcShort(ctx);
});

bot.action(/^direct_lead-(.*)$/, async (ctx) => {
    const data = ctx.match[1];
    const { message_id } = await ctx.reply('Введите номер телефона для свзяи:');
    ctx.session = {
        ...ctx.session,
        state_step: 'phone',
        company: data.slice(0, data.lastIndexOf('-') + 1).replace('-', ''),
        price: parseFloat(data.slice(data.lastIndexOf('-') + 1)),
        message_id,
    }
});
// Обработчик простого текста
bot.on("text", async (ctx, next) => {
    if (!ctx.session?.state_step) {
        return null;
    }
    if (ctx.session?.state_step === 'costFull') {
        if (/^[+-]?\d+(\.\d+)?$/.test(ctx.message.text)) {
            ctx.session = {
                ...ctx.session,
                costFull: ctx.message.text,
            }
            ctx.deleteMessage(ctx.session.message_id);
            ctx.deleteMessage();
            const { message_id } = await ctx.reply('Введите пункт отправления:');
            ctx.session = {
                ...ctx.session,
                state_step: 'insuredAddressUp',
                message_id,
            }
            return await next();
        } else {
            await ctx.telegram.sendMessage(ctx.chat.id, 'Введите только числовые данные. Например: 3000000.55');
            await ctx.reply("Стоимость груза");
        }
    }

    if (ctx.session?.state_step === 'insuredAddressUp') {
        ctx.session = {
            ...ctx.session,
            insuredAddressUp: ctx.message.text,
        }
        ctx.deleteMessage(ctx.session.message_id);
        ctx.deleteMessage();
        const { message_id } = await ctx.telegram.sendMessage(ctx.chat.id, 'Введите пункт назначения:');
        ctx.session = {
            ...ctx.session,
            state_step: 'insuredAddressDown',
            message_id,
        }
        return await next();
    }

    if (ctx.session?.state_step === 'insuredAddressDown') {
        ctx.session = {
            ...ctx.session,
            insuredAddressDown: ctx.message.text,
        }
        ctx.deleteMessage(ctx.session.message_id);
        ctx.deleteMessage();
        const { message_id } = await ctx.telegram.sendMessage(ctx.chat.id, 'Введите нанименование груза:');
        ctx.session = {
            ...ctx.session,
            state_step: 'cargoName',
            message_id,
        }
        return await next();
    }

    if (ctx.session?.state_step === 'phone') {
        if (/^[+-]?\d+(\.\d+)?$/.test(ctx.message.text)) {
            ctx.session = {
                ...ctx.session,
                phone: ctx.message.text,
            }
            const { message_id } = await ctx.reply( 'Введите email для связи с вами:');
            ctx.session = {
                ...ctx.session,
                state_step: 'email',
                message_id,
            }
            return await next();
        } else {
            await ctx.telegram.sendMessage(ctx.chat.id, 'Введите только числовые данные. Например: 89111111111');
            await ctx.reply("Введите номер телефона для связи:");
        }
    }

    if (ctx.session?.state_step === 'email') {
        ctx.session = {
            ...ctx.session,
            email: ctx.message.text,
        }
        for(let i = 0; i <= 100; i++ ){
            k =  ctx.message.message_id-i;
            ctx.deleteMessage(k)
        }
        ctx.reply(`Черновик полиса сформирован его номер ${ctx.session.newDraft.id}! Вы выбрали компанию ${ctx.session.company} В скором времени с вами свяжется наш сотрудник для последующего оформления. Спасибо что выбрали наш сервис!`);
        await sendLead(ctx);
        ctx.session = {}
        await commandStart(ctx);
        return await next();
    }

    if (ctx.session?.state_step === 'cargoName') {
        if (ctx.session?.state_step) {
            ctx.session = {
                ...ctx.session,
                cargoName: ctx.message.text,
                state_step: '',
            }
            await stageFour(ctx);
            return 'success';
        } else {
            await ctx.telegram.sendMessage(ctx.chat.id, 'Пока нету нужной стадии для ввода информации!');
        }
    }
});

// Запуск бота
bot.launch();