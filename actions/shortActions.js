const formData = require("../helpers/formData");
const axios = require('axios');
const {Markup} = require("telegraf");
const Datastore = require("nedb");
require('dotenv').config();
const tokens = new Datastore({filename: 'tokens'});
tokens.loadDatabase();
const valute = [
    {
        "label": "$",
        "value": "dollar"
    },
    {
        "label": "₽",
        "value": "ruble"
    },
    {
        "label": "€",
        "value": "euro"
    },
    {
        "label": "£",
        "value": "pound"
    },
    {
        "label": "¥",
        "value": "yen"
    }
];

const transport = [
    {
        "label": "Автомобильный",
        "value": "automobile"
    },
    {
        "label": "Авиационный",
        "value": "aviation"
    },
    {
        "label": "Железнодорожный",
        "value": "railway"
    },
    {
        "label": "Морской/речной",
        "value": "seariver"
    },
    {
        "label": "Мультимодальный",
        "value": "multimodal"
    }
];

const franchise = [
    {
        "label": "0",
        "value": "0"
    },
    {
        "label": "0,25%",
        "value": "25"
    },
    {
        "label": "0,3% но не менее 3 000 руб.",
        "value": "30"
    },
    {
        "label": "0,5% но не менее 5 000 руб.",
        "value": "50"
    },
    {
        "label": "0,75% но не менее 10 000 руб.",
        "value": "75"
    },
    {
        "label": "1% но не менее 15 000 руб.",
        "value": "100"
    }
];
async function stageOne(ctx) {
    const { message_id } = await ctx.reply('Для расчета стоимости нужно указать данные:');
    await ctx.deleteMessage();
    ctx.session = {
        ...ctx.session,
        message_id: message_id,
    }
    await ctx.reply("Валюта стоимости груза:", {
        reply_markup: {
            inline_keyboard: [
                [ { text: "Российский рубль ₽", callback_data: "stage_2-ruble" } ],
                [ { text: "Доллар США $", callback_data: "stage_2-dollar" }, { text: "Евро €", callback_data: "stage_2-euro" } ],
                [ { text: "Фунт стерлингов £", callback_data: "stage_2-pound" }, { text: "Китайский юань ¥", callback_data: "stage_2-yen" } ],
            ]
        }
    });
}

function handleValidate(ctx, stage) {
    if (ctx.session['state_step'] !== stage) {
        ctx.telegram.sendMessage(ctx.chat.id, 'Вы находитесь на другой стадии! Пожалуйста продолжите оформление.');
    }
}

async function stageFour(ctx) {
    await ctx.reply("Вид транспорта:", {
        reply_markup: {
            inline_keyboard: [
                [ { text: "Автомобильный 🚚", callback_data: "stage_5-automobile" } ],
                [ { text: "Авиационный ✈", callback_data: "stage_5-aviation" }, { text: "Железнодорожный 🚂", callback_data: "stage_5-railway" } ],
                [ { text: "Морской/Речной 🛳", callback_data: "stage_5-seariver" }, { text: "Мультимодальный 🚚✈🚂🛳", callback_data: "stage_5-multimodal" } ],
            ]
        }
    });
    ctx.deleteMessage(ctx.session.message_id);
    ctx.deleteMessage();
}

async function stageFive(ctx) {
    await ctx.reply("Размер франшизы (безусловная):", {
        reply_markup: {
            inline_keyboard: [
                [ { text: "0", callback_data: "stage_6-0" }, { text: "0,25%", callback_data: "stage_6-25" } ],
                [ { text: "0,3%", callback_data: "stage_6-30" }, { text: "0,5%", callback_data: "stage_6-50" } ],
                [ { text: "0,75%", callback_data: "stage_6-75" }, { text: "1%", callback_data: "stage_6-100" } ],
            ]
        }
    });
    ctx.deleteMessage();
}

async function stageSix(ctx) {
    await ctx.reply("Состояние груза:", {
        reply_markup: {
            inline_keyboard: [
                [ { text: "новый", callback_data: "stage_7-0" }, { text: "б/у", callback_data: "stage_7-1" } ],
            ]
        }
    });
    ctx.deleteMessage();
}

async function stageSeven(ctx) {
    await ctx.reply("Разгрузка/Погрузка:", {
        reply_markup: {
            inline_keyboard: [
                [ { text: "Да", callback_data: "stage_8-1" }, { text: "Нет", callback_data: "stage_8-0" } ],
            ]
        }
    });
    ctx.deleteMessage();
}

async function stageEight(ctx) {
    await ctx.reply("Рефрижераторные риски:", {
        reply_markup: {
            inline_keyboard: [
                [ { text: "Да", callback_data: "calc_short-1" }, { text: "Нет", callback_data: "calc_short-0" } ],
            ]
        }
    });
    ctx.deleteMessage();
}

async function getToken(ctx) {
    return await axios.post(`${process.env.API_URL}/api/sign-in-user`, {
        email: process.env.API_LOGIN,
        password: process.env.API_PASSWORD,
    },{
        headers: {
            'Content-Type': 'application/json',
        },
        maxRedirects: 1,
    }).then((response) => {
        ctx.session = {
            ...ctx.session,
            token: response.data.token
        }
        tokens.insert({token: response.data.token, expire_in: 3600});
        return response.data.token;
    }).catch((error) => {
        console.error(error);
        return 'Ошибка';
    });
}

async function waitToken(ctx) {
    tokens.find({}, function (err, docs) {
        ctx.session = {
            ...ctx.session,
            token: docs[docs.length - 1]?.token
        }
    });
    return new Promise((resolve,reject)=>{
        setTimeout(()=>{resolve();} , 1000);
    });
}

//Функция для тестирования
async function startAgg(ctx) {
    await waitToken(ctx);
    const lsToken= `Bearer ${ctx.session?.token}`;
    return axios.post(`${process.env.API_URL}/api/gpt`, {
        query: 'defineCargo',
        cargoFull: 'Трусы',
        addressUp: 'Питер',
        addressDown: 'Москва',
        typeTransport: 'Автомобильный',
    },{
        headers: {
            'Authorization': lsToken,
            'Content-Type': 'application/json',
        },
        maxRedirects: 1,
    }).then(async (response) => {
        /*ctx.session = {
            ...ctx.session,
            cargo: response.data.result,
            range: response.data.resultRange,
        }*/
        //await createPolicy(ctx);
        console.log(response);
        return {cargoFull: response.data.result, range: response.data.resultRange};
    }).catch(async (error) => {
        console.log(error.status);
        await getToken(ctx);
        await startAgg(ctx);
        return false;
    });
}

async function getCargoCategory(ctx) {
    await waitToken(ctx);
    const lsToken= `Bearer ${ctx.session.token}`;
    return await axios.post(`${process.env.API_URL}/api/gpt`, {
        query: 'defineCargo',
        cargoFull: ctx.session.cargoName,
        addressUp: ctx.session.insuredAddressUp,
        addressDown: ctx.session.insuredAddressDown,
        typeTransport: transport.find(data => data.value === ctx.session.transport).label,
    },{
        headers: {
            'Authorization': lsToken,
            'Content-Type': 'application/json',
        },
        maxRedirects: 1,
    }).then(async (response) => {
        ctx.session = {
            ...ctx.session,
            cargo: response.data.result,
            range: response.data.resultRange,
        }
        console.log(response.data);
        await createPolicy(ctx);
        return {cargoFull: response.data.result, range: response.data.resultRange};
    }).catch(async (error) => {
        console.log(error);
        await getToken(ctx);
        await getCargoCategory(ctx);
        return false;
    });
}

async function startCalculationShort(ctx) {
    const message = await ctx.reply(
        `
    Вы ввели данные:➡
    Вид транспорта: ${transport.find(data => data.value === ctx.session.transport).label};
    Франшиза: ${franchise.find(data => data.value === ctx.session.franchise.toString()).label};
    Цена: ${ctx.session.costFull} ${valute.find(data => data.value === ctx.session.valute).label};
    Наименование груза: ${ctx.session.cargoName};
    Состояние груза: ${!ctx.session.newCargo ? 'новый' : 'Б/У'};
    Разгрузка/погрузка: ${ctx.session.upload ? 'Да' : 'Нет'};
    Рефрежераторные риски: ${ctx.session.refrisks ? 'Да' : 'Нет'};`);
    const sentMessage = await ctx.replyWithSticker('CAACAgIAAxkBAAEMP2pnoy4TJpXv_q3GnL9FIlOkPoq2yAACUgADr8ZRGgSvecXtKHqONgQ');
    setTimeout(() => {
            ctx.deleteMessage(sentMessage.message_id);
            ctx.deleteMessage(message.message_id);
        }, 5700);
    //не убирать без него падать удаление стикера будет
    console.log(sentMessage);
    console.log(message);
    const lsToken= `Bearer ${ctx.session.token}`;
    return await axios.post(`${process.env.API_URL}/api/policies/calculation`, {
        calcType: 'short',
        draftHash: ctx.session.newDraft.hash,
        useEvents: false,
    },{
        headers: {
            'Authorization': lsToken,
            'Content-Type': 'application/json',
        },
        maxRedirects: 1,
    }).then((response) => {
        return 'start';
    }).catch((error) => {
        return 'canceled';
    });
}

async function getCompanies(ctx) {
    const lsToken= `Bearer ${ctx.session.token}`;
    return axios.get(`${process.env.API_URL}/api/companies?type=cargoInsurance&integration=all`,{
        headers: {
            'Authorization': lsToken,
            'Content-Type': 'application/json',
        },
        maxRedirects: 1,
    }).then(async (response) => {
        if (response.data) {
            return response.data;
        }
    }).catch((error) => {
        return 'canceled';
    });
}

async function calculationStatus(ctx) {
    const lsToken= `Bearer ${ctx.session.token}`;
    const status = () => axios.get(`${process.env.API_URL}/api/policies/calculation-status?draftHash=${ctx.session.newDraft.hash}`,{
        headers: {
            'Authorization': lsToken,
            'Content-Type': 'application/json',
        },
        maxRedirects: 1,
    }).then(async (response) => {
        if (response.data?.calcStatus === 'complete') {
            const companies = await getCompanies(ctx);
            const arrayBtnStatus = [];
            response.data.result.map((data) => {
                //const logo = `./sprites/${data['polis_online_code']}.jpg`;
                const name = companies[data['polis_online_code']] ? `${companies[data['polis_online_code']]['name']}` : data['polis_online_code'];
                if (!data.errorCriticalMessage && data['price']) {
                    arrayBtnStatus.push([Markup.button.callback(`Оформить ${name} ${data['price'] ? data['price']: '???'} ${valute.find(data => data.value === ctx.session.valute).label}`, `direct_lead-${name}-${data['price']}`)]);
                }
                /*if (!data.errorMessage && !data.errorCriticalMessage) {
                    ctx.replyWithPhoto(
                        {
                            source: logo
                        },
                        {
                            caption: `Вас готова оформить компания ${name} на сумму <b>${data['price'] ? data['price']: '???'} ${valute.find(data => data.value === ctx.session.valute).label}</b>`,
                            parse_mode: 'HTML',
                            ...Markup.inlineKeyboard([
                                Markup.button.callback('➡ Оформить', `direct_lead-${name}-${data['price']}`),
                            ]),
                        });
                } else if (!data.errorCriticalMessage) {
                    ctx.replyWithPhoto(
                        {
                            source: logo
                        },
                        {
                            caption: `Вас готова оформить компания ${name} на сумму <b>${data['price'] ? data['price']: '???'} ${valute.find(data => data.value === ctx.session.valute).label}</b>,но с учетом <b>согласования</b>`,
                            parse_mode: 'HTML',
                            ...Markup.inlineKeyboard([
                                Markup.button.callback('➡ Оформить', `direct_lead-${name}-${data['price']}`),
                            ]),
                        });
                }*/
            })
            clearInterval(interval);
            ctx.reply('Вас готовы оформить:', {
                ...Markup.inlineKeyboard(
                    arrayBtnStatus
                ),
            })
            //ctx.deleteMessage(ctx.session.message_id);
            return true;
        }
    }).catch((error) => {
        return 'canceled';
    });
    const interval = setInterval(() => status(), 5000);
}

async function sendLead(ctx) {
    const comment = `
    Вид транспорта: ${transport.find(data => data.value === ctx.session.transport).label};
    Франшиза: ${franchise.find(data => data.value === ctx.session.franchise.toString()).label};
    Стоимость груза: ${ctx.session.costFull} ${valute.find(data => data.value === ctx.session.valute).label};
    Наименование груза: ${ctx.session.cargoName};
    Состояние груза: ${!ctx.session.newCargo ? 'новый' : 'Б/У'};
    Разгрузка/погрузка: ${ctx.session.upload ? 'Да' : 'Нет'};
    Рефрежераторные риски: ${ctx.session.refrisks ? 'Да' : 'Нет'};
    Телефон: ${ctx.session.phone};
    Email: ${ctx.session.email};
    Выбранная компания: ${ctx.session.company};
    Дополнительная информация: ${ctx.session.more_text};
    Имя пользователя в Телеграмме: ${ctx.from?.username};`;
    const lsToken= `Bearer ${ctx.session.token}`;
    const policy = await axios.post(`${process.env.API_URL}/api/widgets/sendTestLeadToCrm`, {
        leadType: 'bot',
        data: {
            comment,
            email: ctx.session.email,
            phone: ctx.session.phone,
            firstName: ctx.from?.first_name,
            secondName: '',
            lastName: ctx.from?.last_name,
            price: ctx.session.price,
            assigned: '47367',
            title: 'Оформление через тг бота по грузам',
        },
        widgetId: 15200,
        policyId: ctx.session.newDraft.id,
    }, {
        headers: {
            'Authorization': lsToken,
            'Content-Type': 'application/json',
        },
        maxRedirects: 1,
    }).then((response) => {
        console.log(response.data);
        return true;
    }).catch((error) => {
        return false;
    });

    return policy;
}

async function createPolicy(ctx) {
    const data = {...formData,
        valute: valute.find(data => data.value === ctx.session.valute),
        transport: transport.find(data => data.value === ctx.session.transport),
        franchise: franchise.find(data => data.value === ctx.session.franchise.toString()),
        costFull: ctx.session.costFull,
        cargoFull: ctx.session.cargoName,
        range: ctx.session.range,
        cargo: ctx.session.cargo,
        usedcargo: ctx.session.newCargo,
        loadunload: ctx.session.upload,
        refrisks: ctx.session.refrisks,
        insuredAddressUp: {
            value: ctx.session.insuredAddressUp,
            data: {}
        },
        insuredAddressDown: {
            value: ctx.session.insuredAddressDown,
            data: {}
        }
    };
    const lsToken= `Bearer ${ctx.session.token}`;
    const policy = await axios.post(`${process.env.API_URL}/api/policy`, {
        type: 'cargoInsurance',
        formData: data,
        service: true,
        product: 'cargoInsurance',
        leadSource: '',
        linkToDeal: '',
        managerAttracted: '',
        customField: null,
        newAgent: '',
    }, {
        headers: {
            'Authorization': lsToken,
            'Content-Type': 'application/json',
        },
        maxRedirects: 1,
    }).then((response) => {
        ctx.session = {
            ...ctx.session,
            newDraft: response.data
        }
        return true;
    }).catch((error) => {
        return false;
    });
    if (policy) {
        const calc = await startCalculationShort(ctx);
        if (calc === 'start') {
            await calculationStatus(ctx);
        }
    }
}

async function calcShort(ctx) {
    await getCargoCategory(ctx);
}


module.exports = { stageOne, stageFour, stageFive, stageSix, stageSeven, stageEight, calcShort, startAgg, sendLead };